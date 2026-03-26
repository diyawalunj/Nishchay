import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const email = process.env.SMTP_EMAIL;
const password = process.env.SMTP_PASSWORD;

if (!email || !password) {
  console.error('❌ SMTP_EMAIL or SMTP_PASSWORD not set in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: email, pass: password },
});

const ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
];

async function testEmail() {
  console.log('🧪 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified!');

    console.log('📧 Sending test admin notification...');
    await transporter.sendMail({
      from: `"Nishchay Test" <${email}>`,
      to: ADMIN_EMAILS.join(', '),
      subject: '[TEST] Admin Notification',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>Nishchay Defence Test</h1>
          <p>This is a test notification to verify the email system is working.</p>
          <p>If you see this, the configuration is correct!</p>
        </div>
      `,
    });
    console.log('✅ Test email sent successfully to:', ADMIN_EMAILS.join(', '));
  } catch (error: any) {
    console.error('❌ Email test failed:', error.message);
    if (error.message.includes('Invalid login')) {
      console.log('💡 Tip: Ensure you are using a Gmail App Password, not your regular password.');
    }
  }
}

testEmail();
