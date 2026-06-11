import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(this.configService.get<string>('SMTP_PORT') || 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async enviarRecuperacionContrasena(destinatario: string, nombre: string, enlace: string): Promise<void> {
    const remitente = this.configService.get<string>('SMTP_FROM') || '"UDEMM Global" <no-reply@udemm.edu.ar>';

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8" /></head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#0d2244;padding:28px 32px;text-align:center;">
                  <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1a5ea8;border-radius:10px;margin-bottom:12px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:bold;">U</span>
                  </div>
                  <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.05em;">UDEMM Global</h1>
                  <p style="margin:4px 0 0;color:rgba(147,197,253,0.6);font-size:12px;">Plataforma de Gestión Académica</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Recuperación de contraseña</p>
                  <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;font-weight:700;">Hola, ${nombre}</h2>
                  <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta en UDEMM Global.
                    Hacé clic en el botón para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.
                  </p>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="${enlace}" style="display:inline-block;background:#0f4c81;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                      Restablecer contraseña
                    </a>
                  </div>
                  <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
                    Si no podés hacer clic en el botón, copiá y pegá este enlace en tu navegador:
                  </p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all;">${enlace}</p>
                </td>
              </tr>
              <tr>
                <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                    Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.<br />
                    © 2026 UDEMM · Sistema de Gestión Institucional
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: remitente,
        to: destinatario,
        subject: 'Restablecer contraseña — UDEMM Global',
        html,
      });
      this.logger.log(`Correo de recuperación enviado a ${destinatario}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo a ${destinatario}:`, error);
      throw new Error('No se pudo enviar el correo. Verificá la configuración SMTP.');
    }
  }
}
