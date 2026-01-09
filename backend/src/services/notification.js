/**
 * Notification service
 * На этапе разработки выводит уведомления в console.log
 * В будущем будет интегрирован с email-сервисом
 */

/**
 * Отправляет email уведомление
 * @param {string} email - Email адрес получателя
 * @param {string} subject - Тема письма
 * @param {string} message - Текст сообщения
 */
export async function sendEmailNotification(email, subject, message) {
  // На этапе разработки выводим в console.log
  console.log('='.repeat(50));
  console.log('[EMAIL NOTIFICATION]');
  console.log(`To: ${email}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
  console.log('='.repeat(50));

  // TODO: В будущем здесь будет интеграция с email-сервисом
  // Например: await emailService.send({ to: email, subject, text: message });
  
  return true;
}

