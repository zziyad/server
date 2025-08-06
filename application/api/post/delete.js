({
  access: 'admin',
  method: async ({ id }) => {
    try {
      const result = await domain.post.delete(id);
      return { status: 'fulfilled', response: result };
    } catch (error) {
      console.error(error);
      return {
        status: 'rejected',
        response: error,
      };
    }
  },
});
