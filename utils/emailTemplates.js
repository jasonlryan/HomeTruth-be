const getEmailTemplates = () => {
    return {
      passwordReset: {
        subject: 'Password Reset Request',
        getHTML: (userName, resetUrl) => {
          // Your HTML template here
        },
        getText: (userName, resetUrl) => {
          // Your text template here
        }
      },
      welcome: {
        subject: 'Welcome to Our Platform!',
        getHTML: (userName) => {
          // Your HTML template here
        },
        getText: (userName) => {
          // Your text template here
        }
      }
    };
  };