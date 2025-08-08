({
  access: 'public',
  method: async ({ name, email, message }) => {
    const transporter = npm.nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'exceland.az@hotmail.com', // your Office 365 email
        pass: 'Nurana_86', // your email password
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });

    const mailOptions = {
      from: 'exceland.az@hotmail.com',
      to: 'exceland.az@hotmail.com', // your Office 365 email
      subject: `Contact form submission from ${name}`,
      text: `New message from ${name} (${email}):\n\n${message}`,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      return { status: 'Email sent', response: info?.response };
    } catch (error) {
      return { status: 'rejected', response: error.toString() };
    }
  },
});
