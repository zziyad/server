({
  access: 'public',
  method: async ({ username, password, email }) => {
    console.log({ username, password, email, 'PROVIDER': api.auth });
    try {
      const { getUser, registerUser } = api.auth.provider();
      const user = await getUser(email);
      if (user)
        return { status: 'rejected', response: 'User Name already exists' };
      const hash = await metarhia.metautil.hashPassword(password);
      await registerUser(username, email, hash);
      return { status: 'success', response: 'Success registration' };
    } catch (error) {
      console.log({ errorR: error.stack });
      return {
        status: 'rejected',
        response: 'Server Error',
      };
    }
  },
});




// ({
//   access: 'public',
//   method: async (username, email, password) => {
//     console.log({ username, email, password });
    
//     if (!username || !email || !password) {
//       return {
//         status: 'rejected',
//         response: 'Username, email and password are required',
//       };
//     }

//     try {
//       const { getUser, registerUser } = api.auth.provider();
//       const existingUser = await getUser(email);
      
//       if (existingUser) {
//         return { 
//           status: 'rejected', 
//           response: 'User with this email already exists' 
//         };
//       }
      
//       const hash = await metarhia.metautil.hashPassword(password);
//       await registerUser(username, email, hash);
      
//       console.log(`Registered user: ${email}`);
//       return { 
//         status: 'fulfilled', 
//         response: 'User registered successfully' 
//       };
//     } catch (error) {
//       console.error('Registration error:', error);
//       return {
//         status: 'rejected',
//         response: 'Server error occurred',
//       };
//     }
//   },
// });
