import { Component, AfterViewInit } from '@angular/core';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements AfterViewInit {

  ngAfterViewInit(): void {
    if (google && google.accounts) {
      google.accounts.id.initialize({
        client_id: '338305920567-bhd608ebcip1u08qf0gb5f08o4je4dnp.apps.googleusercontent.com',
        callback: (response: any) => this.handleCredentialResponse(response)
      });

      // Renderiza botão dentro do #g_id_signin
      google.accounts.id.renderButton(
        document.getElementById('g_id_signin'),
        { theme: 'filled_black', size: 'large', shape: 'pill' }
      );


      // Opcional: já exibe prompt automático se usuário tem sessão
      google.accounts.id.prompt();
    }
  }

  handleCredentialResponse(response: any) {
    console.log('Token JWT:', response.credential);
  }
}
