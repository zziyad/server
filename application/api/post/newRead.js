({
  access: 'public',
  method: async (postObject) => {
    // console.log({ ID: postObject.postId, context: context.client.session })
    if (postObject.limit === 1 && postObject.postId === null) {
      return {
        status: 'rejected',
        response: 'No post',
      };
    }
    try {
      const result = await domain.post.newGetPosts(postObject);
      return { status: 'fulfilled', response: result };
    } catch (error) {
      console.error(error);
      return {
        status: 'rejected',
        response: 'Server Error',
      };
    }
  },
});
