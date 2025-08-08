({
  access: 'public',
  method: async (post) => {
    try {
      const result = await domain.Post.add(context, post);
      return { status: 'fulfilled', result };
    } catch (error) {
      console.error(error);
      return {
        status: 'rejected',
        reason: error.toJSON(),
      };
    }
  },
});
