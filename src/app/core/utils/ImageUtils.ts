export class ImageUtils {
  /**
   * Converte arquivo em base64 JPEG otimizado
   * @param file Arquivo de imagem
   * @param quality Qualidade de compressão (0.0 - 1.0)
   * @param maxWidth Largura máxima (mantém proporção). Se não informado, mantém tamanho original
   */
  static async toOptimizedBase64(
    file: File,
    quality: number = 0.72,
    maxWidth?: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas não suportado');

          let { width, height } = img;

          // 🔄 Redimensiona mantendo proporção
          if (maxWidth && width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          // 📌 Converte para JPEG otimizado
          const optimized = canvas.toDataURL('image/jpeg', quality);
          resolve(optimized);
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
