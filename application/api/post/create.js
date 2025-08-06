({
  access: 'admin',
  method: async (post) => {
    if (Object.keys(post).length === 0) {
      return { status: 'rejected', response: 'Empty post object' };
    }
    const { id } = context.client.session.state;
    try {
      const result = await domain.post.create(post, id);
      return { status: 'fulfilled', response: result };
    } catch (error) {
      console.error({ ERRRR: error });
      return {
        status: 'rejected',
        response: error.message,
      };
    }
  },
});
