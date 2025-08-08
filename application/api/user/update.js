({
  access: 'admin',
  method: async ({ id, profilePicture = '', username = '', password = '' }) => {
    const target = {};

    console.log({
      id,
      profilePicture,
      username,
      password,
    });

    if (password !== '') {
      if (password.length < 6)
        return {
          status: 'rejected',
          response: 'Password must be at least 6 characters',
        };
      const hash = await metarhia.metautil.hashPassword(password);
      target['password'] = hash;
    }

    if (username !== '') {
      if (username.length < 4 || username.length > 20)
        return {
          status: 'rejected',
          response: 'Username must be between 3 and 20 characters',
        };

      if (username.includes(' '))
        return {
          status: 'rejected',
          response: 'Username cannot contain spaces',
        };

      if (!username.match(/^[a-zA-Z0-9]+$/))
        return {
          status: 'rejected',
          response: 'Username can only contain letters and numbers',
        };

      target['username'] = username;
    }

    if (profilePicture !== '') target['profile_picture'] = profilePicture;

    if (JSON.stringify(target) === '{}') {
      return { status: 'rejected', response: 'No fields have been updated' };
    }

    try {
      const user = await db.pg.row('users', ['*'], { id });
      if (!user) {
        return { status: 'rejected', response: 'User not found' };
      }
      const { password: existingPassword } = user;

      if (password !== '' && password === existingPassword) {
        delete target.password;
      }

      await db.pg.update('users', target, { id });
      return { status: 'updated', response: target };
    } catch (error) {
      console.error('Error updating user:', error);
      return { status: 'rejected', response: 'Error updating user' };
    }
  },
});
