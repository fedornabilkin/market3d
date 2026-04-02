/**
 * Notification service
 * Делегирует отправку писем в EmailService (NotiSend API + шаблоны).
 * Без NOTISEND_API_KEY выводит уведомления в console.log.
 */

import { sendWithTemplate, sendRaw } from './emailService.js';

/**
 * Отправляет email по шаблону с данными.
 * @param {string} email - Email адрес получателя
 * @param {string} templateName - Имя шаблона (registration, verification_code, email_change_request, email_changed, password_changed)
 * @param {Record<string, unknown>} data - Данные для подстановки в шаблон
 * @returns {Promise<{ success: boolean, error?: Error }>}
 */
export async function sendTemplatedEmail(email, templateName, data = {}) {
  const result = await sendWithTemplate(email, templateName, data);
  if (!result.success && result.error) {
    console.error('[Notification] sendTemplatedEmail failed:', result.error);
  }
  return result;
}

/**
 * Отправляет email уведомление (произвольные тема и текст).
 * @param {string} email - Email адрес получателя
 * @param {string} subject - Тема письма
 * @param {string} message - Текст сообщения
 */
export async function sendEmailNotification(email, subject, message) {
  const html = `<p style="font-family: sans-serif; line-height: 1.5;">${escapeHtml(message)}</p>`;
  const result = await sendRaw(email, subject, html, message);
  if (!result.success && result.error) {
    console.error('[Notification] sendEmailNotification failed:', result.error);
  }
  return result.success;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
