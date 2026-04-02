/**
 * Email service — интеграция с NotiSend Email API.
 * Документация: https://notisend.ru/dev/email/api/
 */
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_SUBJECTS: Record<string, string> = {
  registration: 'Подтверждение регистрации',
  verification_code: 'Код подтверждения email',
  email_change_request: 'Подтверждение смены email',
  email_changed: 'Email изменён',
  password_changed: 'Пароль изменён',
  plain: 'Уведомление',
};

export interface SendWithTemplateResult {
  success: boolean;
  error?: Error;
}

interface NotiSendSendPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export class EmailService {
  private apiKey: string | null = null;
  private apiUrl: string;
  private fromEmail: string;
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates', 'email');
    this.apiKey = process.env.NOTISEND_API_KEY ?? null;
    this.apiUrl = (process.env.NOTISEND_API_URL || 'https://api.notisend.ru').replace(/\/$/, '');
    this.fromEmail = process.env.NOTISEND_FROM_EMAIL || process.env.YANDEX_EMAIL || 'noreply@notisend.ru';
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private loadAndCompileTemplate(templateName: string): Handlebars.TemplateDelegate | null {
    const filePath = path.join(this.templatesDir, `${templateName}.html`);
    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      return Handlebars.compile(source);
    } catch (err) {
      console.error(`[EmailService] Failed to load template ${templateName}:`, err);
      return null;
    }
  }

  private getSubject(templateName: string): string {
    return TEMPLATE_SUBJECTS[templateName] ?? 'Уведомление';
  }

  /**
   * Отправка письма через NotiSend Email API.
   * Документация: https://notisend.ru/dev/email/api/
   * При отличии формата запроса — скорректировать body и url по официальной документации.
   */
  private async sendViaNotiSend(payload: NotiSendSendPayload): Promise<SendWithTemplateResult> {
    if (!this.isConfigured) {
      console.log('='.repeat(50));
      console.log('[EMAIL NOTIFICATION - NotiSend API key not configured]');
      console.log(`To: ${payload.to}`);
      console.log(`Subject: ${payload.subject}`);
      console.log('='.repeat(50));
      return { success: true };
    }

    const sendPath = process.env.NOTISEND_SEND_PATH || '/v1/email/messages';
    const url = `${this.apiUrl}${sendPath}`;
    const body: Record<string, string> = {
      to: payload.to,
      subject: payload.subject,
      from: payload.from || this.fromEmail,
      from_email: `noreply@vsqr.ru`,
      from_name: `vsqr.ru`,
    };
    if (payload.html) body.html = payload.html;
    if (payload.text) body.text = payload.text;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        let detail = text;
        try {
          const json = JSON.parse(text) as { detail?: string; message?: string };
          detail = json.detail ?? json.message ?? text;
        } catch {
          // leave detail as text
        }
        throw new Error(`NotiSend API (${url}) ${response.status}: ${detail}`);
      }

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[EmailService] NotiSend send failed:', error);
      return { success: false, error };
    }
  }

  async sendWithTemplate(
    to: string,
    templateName: string,
    data: Record<string, unknown> = {}
  ): Promise<SendWithTemplateResult> {
    const template = this.loadAndCompileTemplate(templateName);
    if (!template) {
      return { success: false, error: new Error(`Template ${templateName} not found`) };
    }

    const html = template(data);
    const subject = this.getSubject(templateName);
    const text = html.replace(/<[^>]*>/g, '').trim();

    return this.sendViaNotiSend({
      to,
      subject,
      html,
      text,
      from: this.fromEmail,
    });
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<SendWithTemplateResult> {
    return this.sendViaNotiSend({
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, '').trim(),
      from: this.fromEmail,
    });
  }
}

const emailService = new EmailService();

export function sendWithTemplate(
  to: string,
  templateName: string,
  data: Record<string, unknown> = {}
): Promise<SendWithTemplateResult> {
  return emailService.sendWithTemplate(to, templateName, data);
}

export function sendRaw(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<SendWithTemplateResult> {
  return emailService.send(to, subject, html, text);
}
