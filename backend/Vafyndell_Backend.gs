/************** 
 * Code.gs — CRUD por ID + 3 fases
 * 1. Consulta IDs por aba (TextFinder)
 * 2. Upload/Update/Delete de imagens (unitário)
 * 3. Gravação no Sheets (create/update em lote, delete linha a linha)
 * - Cliente gera IDs, Script encontra index
 * - Não duplica IDs já existentes no CREATE
 * - UPDATE/DELETE só em IDs existentes
 * - Delete também remove imagens associadas
 * - Retorna { ok: true/false, erro: "..." }
 * - Atualiza Metadados em lote
 * - Agora suporta getAll e getById via payloads
 **************/

// ======== CONFIG ========
const CLIENT_ID = '338305920567-bhd608ebcip1u08qf0gb5f08o4je4dnp.apps.googleusercontent.com';

// ======== Utils ========
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return json({ ok: true, ts: new Date().toISOString() }); }
function doOptions() { return ContentService.createTextOutput(""); }

/** POST principal */
function doPost(e) {
  try {
    const body = e.postData ? (e.postData.contents || "{}") : "{}";
    let req = {};
    try { req = JSON.parse(body || "{}"); }
    catch (err) { return json({ ok: false, erro: "JSON inválido", raw: body }); }

    const sheetId = req.sheetId;
    const folderId = req.folderId || null;
    const payloads = req.payloads || {};
    const ss = sheetId ? SpreadsheetApp.openById(sheetId) : null;

    const result = Controller.processBatch({ ss, payloads, folderId });
    return json(result);

  } catch (err) { return json({ ok: false, erro: String(err) }); }
}

// ========== Drive Client ==========
const DriveClient = {
  upload({ folderId, base64, name, mimeType }) {
    const folder = DriveApp.getFolderById(folderId);
    const blob = toBlob_(base64, mimeType, name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { id: file.getId(), url: "https://lh3.googleusercontent.com/d/" + file.getId() };
  },

  remove({ publicUrlOrId }) {
    const id = extractDriveId_(publicUrlOrId);
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
    return { ok: true, deletedId: id };
  }
};

// ========== Controller ==========
const Controller = {
  processBatch({ ss, payloads, folderId }) {
    const results = {};
    const modifiedTabs = new Set();

    // === Fase 1: Mapear IDs por aba ===
    const idMaps = {};
    const tabs = new Set([
      ...Object.keys(payloads.create || {}),
      ...Object.keys(payloads.updateById || {}),
      ...Object.keys(payloads.deleteById || {}),
      ...Object.keys(payloads.getById || {})
    ]);
    tabs.forEach(tab => {
      const sh = ss.getSheetByName(tab);
      if (!sh) return;
      idMaps[tab] = mapIds_(sh);
    });

    // === Fase 2: Tratar imagens (unitário) ===

    // CREATE: resolver imagens
    if (payloads.create) {
      Object.keys(payloads.create).forEach(tab => {
        payloads.create[tab] = payloads.create[tab].map(obj => {
          if (obj.imagem && isBase64_(obj.imagem)) {
            const mt = guessMime_(obj.imagem);
            const up = DriveClient.upload({
              folderId: obj.folderId || folderId,
              base64: obj.imagem,
              name: genName_(mt),
              mimeType: mt
            });
            obj.imagem = up.url;
          }
          return obj;
        });
      });
    }

    // UPDATE: resolver imagens
    if (payloads.updateById) {
      Object.keys(payloads.updateById).forEach(tab => {
        const header = ss.getSheetByName(tab) ? readHeader_(ss.getSheetByName(tab)) : [];
        payloads.updateById[tab] = payloads.updateById[tab].map(obj => {
          const rowIndex = idMaps[tab]?.[obj.id];
          if (!rowIndex) return { ...obj, _erro: "ID não encontrado" };

          const current = asObject_(header, ss.getSheetByName(tab).getRange(rowIndex, 1, 1, header.length).getValues()[0], rowIndex);

          if ("imagem" in obj) {
            const v = obj.imagem;
            if (v === "" || v === "-") {
              if (current.imagem && isPublicUrl_(current.imagem)) {
                DriveClient.remove({ publicUrlOrId: current.imagem });
              }
              obj.imagem = "";
            } else if (isBase64_(v)) {
              const mt = guessMime_(v);
              const up = DriveClient.upload({
                folderId: obj.folderId || folderId,
                base64: v,
                name: genName_(mt),
                mimeType: mt
              });
              obj.imagem = up.url;
            }
          }
          return obj;
        });
      });
    }

    // DELETE: marcar imagens a excluir
    if (payloads.deleteById) {
      Object.keys(payloads.deleteById).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        const header = sh ? readHeader_(sh) : [];
        payloads.deleteById[tab] = payloads.deleteById[tab].map(obj => {
          const rowIndex = idMaps[tab]?.[obj.id];
          if (!rowIndex) return { ...obj, _erro: "ID não encontrado" };

          const rowVals = sh.getRange(rowIndex, 1, 1, header.length).getValues()[0];
          const current = asObject_(header, rowVals, rowIndex);
          if (current.imagem && isPublicUrl_(current.imagem)) {
            DriveClient.remove({ publicUrlOrId: current.imagem });
          }
          return { ...obj, _rowIndex: rowIndex };
        });
      });
    }

    // === Fase 3: Atualizar Sheets ===

    // CREATE em lote
    if (payloads.create) {
      results.create = {};
      Object.keys(payloads.create).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        if (!sh) { results.create[tab] = [{ ok: false, erro: "Aba não encontrada" }]; return; }
        const header = readHeader_(sh);

        const newRows = [];
        const created = [];

        payloads.create[tab].forEach(obj => {
          if (idMaps[tab][obj.id]) {
            created.push({ ...obj, ok: false, erro: "ID já cadastrado" });
            return;
          }
          newRows.push(header.map(h => obj[h] ?? ""));
          created.push({ ...obj, ok: true });
        });

        if (newRows.length > 0) {
          const startRow = sh.getLastRow() + 1;
          sh.getRange(startRow, 1, newRows.length, header.length).setValues(newRows);
          newRows.forEach((vals, i) => {
            const idx = startRow + i;
            created[i].index = idx;
            header.forEach((h, j) => created[i][h] = vals[j]);
          });
          modifiedTabs.add(tab);
        }
        results.create[tab] = created;
      });
    }

    // UPDATE em lote
    if (payloads.updateById) {
      results.updateById = {};
      Object.keys(payloads.updateById).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        if (!sh) { results.updateById[tab] = [{ ok: false, erro: "Aba não encontrada" }]; return; }
        const header = readHeader_(sh);

        const updates = payloads.updateById[tab].filter(o => !o._erro);
        const invalid = payloads.updateById[tab].filter(o => o._erro).map(o => ({ ...o, ok: false, erro: o._erro }));

        if (updates.length > 0) {
          const minRow = Math.min(...updates.map(u => idMaps[tab][u.id]));
          const maxRow = Math.max(...updates.map(u => idMaps[tab][u.id]));
          const range = sh.getRange(minRow, 1, maxRow - minRow + 1, header.length);
          const values = range.getValues();

          const updated = [];
          updates.forEach(u => {
            const rowIndex = idMaps[tab][u.id];
            const rowVals = values[rowIndex - minRow];
            header.forEach((h, i) => {
              if (h in u) rowVals[i] = u[h];
            });
            values[rowIndex - minRow] = rowVals;
            updated.push({ ...asObject_(header, rowVals, rowIndex), ok: true });
          });

          range.setValues(values);
          results.updateById[tab] = [...updated, ...invalid];
          modifiedTabs.add(tab);
        } else {
          results.updateById[tab] = invalid;
        }
      });
    }

    // DELETE linha a linha
    if (payloads.deleteById) {
      results.deleteById = {};
      Object.keys(payloads.deleteById).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        if (!sh) { results.deleteById[tab] = [{ ok: false, erro: "Aba não encontrada" }]; return; }

        const valid = payloads.deleteById[tab].filter(o => o._rowIndex);
        const invalid = payloads.deleteById[tab].filter(o => o._erro).map(o => ({ ...o, ok: false, erro: o._erro }));

        valid.sort((a, b) => b._rowIndex - a._rowIndex);

        const deleted = [];
        valid.forEach(o => {
          sh.deleteRow(o._rowIndex);
          deleted.push({ id: o.id, ok: true });
        });

        results.deleteById[tab] = [...deleted, ...invalid];
        if (deleted.length > 0) modifiedTabs.add(tab);
      });
    }

    // GET ALL
    if (payloads.getAll) {
      results.getAll = {};
      (payloads.getAll || []).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        if (!sh) {
          results.getAll[tab] = [{ ok: false, erro: "Aba não encontrada" }];
          return;
        }
        const header = readHeader_(sh);
        const totalRows = sh.getLastRow();
        if (totalRows <= 1) {
          results.getAll[tab] = [];
          return;
        }
        const values = sh.getRange(2, 1, totalRows - 1, header.length).getValues();
        results.getAll[tab] = values.map((row, i) => asObject_(header, row, i + 2));
      });
    }

    // GET BY ID
    if (payloads.getById) {
      results.getById = {};
      Object.keys(payloads.getById).forEach(tab => {
        const sh = ss.getSheetByName(tab);
        if (!sh) {
          results.getById[tab] = [{ ok: false, erro: "Aba não encontrada" }];
          return;
        }
        const header = readHeader_(sh);
        results.getById[tab] = payloads.getById[tab].map(obj => {
          const rowIndex = idMaps[tab]?.[obj.id];
          if (!rowIndex) return { id: obj.id, ok: false, erro: "ID não encontrado" };
          const rowVals = sh.getRange(rowIndex, 1, 1, header.length).getValues()[0];
          return { ...asObject_(header, rowVals, rowIndex), ok: true };
        });
      });
    }

    // Atualiza metadados
    modifiedTabs.forEach(tab => updateMetadata_(ss, tab));
    return results;
  }
};

// ========== Helpers ==========
function mapIds_(sh) {
  const header = readHeader_(sh);
  const colIndex = header.indexOf("id") + 1;
  if (colIndex <= 0) return {};
  const totalRows = sh.getLastRow();
  if (totalRows <= 1) return {};
  const range = sh.getRange(2, colIndex, totalRows - 1);
  const values = range.getValues().flat();
  const map = {};
  values.forEach((id, i) => {
    if (id) map[id] = i + 2;
  });
  return map;
}

function updateMetadata_(ss, sheetName) {
  let meta = ss.getSheetByName('Metadados');
  if (!meta) {
    meta = ss.insertSheet('Metadados');
    // agora a tabela tem 3 colunas: id, SheetName e UltimaModificacao
    meta.getRange(1, 1, 1, 3).setValues([['id', 'SheetName', 'UltimaModificacao']]);
  }

  const now = new Date().toISOString();
  const data = meta.getRange(2, 1, Math.max(meta.getLastRow() - 1, 1), 3).getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === sheetName) { // compara pelo id
      meta.getRange(2 + i, 3).setValue(now);
      return;
    }
  }

  // novo registro → id = sheetName
  meta.appendRow([sheetName, sheetName, now]);
}


function readHeader_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn())
    .getValues()[0].map(v => String(v || '').trim()).filter(Boolean);
}
function asObject_(header, rowVals, rowIndex) {
  const obj = {}; header.forEach((h, i) => obj[h] = rowVals[i]); obj.index = rowIndex; return obj;
}
function extractDriveId_(value) {
  const s = (value || "").trim();
  let m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}
function isBase64_(s) {
  return typeof s === "string" && (s.startsWith("data:") || /^[A-Za-z0-9+/=]+$/.test(s));
}
function guessMime_(s) {
  const m = s.match(/^data:([^;]+);base64,/i);
  return m ? m[1] : "application/octet-stream";
}
function toBlob_(b64, mt, name) {
  if (b64.startsWith("data:")) {
    const i = b64.indexOf(";base64,");
    mt = guessMime_(b64);
    b64 = b64.substring(i + 8);
  }
  const bytes = Utilities.base64Decode(b64);
  return Utilities.newBlob(bytes, mt, name || genName_(mt));
}
function genName_(mt) {
  return "img_" + new Date().toISOString().replace(/[:.TZ-]/g, "") +
    "_" + Math.random().toString(36).slice(2, 8) + extFromMime_(mt);
}
function extFromMime_(mt) { return mt.includes("png") ? ".png" : ".jpg"; }
function isPublicUrl_(s) { return typeof s === "string" && /googleusercontent\.com\/d\//.test(s); }
