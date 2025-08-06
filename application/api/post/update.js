({
  access: 'admin',
  method: async (formData) => {
    //TODO: check formData is it empty or not
    // console.log({ formData });
    try {
      const result = await domain.post.update(formData);
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
