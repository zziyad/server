async (formData) => {
  try {
    const { slug, images,  post_id, ...rest } = formData;
    console.log({ rest });
    await db.pg.update('new_posts', { ...rest }, { slug });
    await db.pg.update('images', { images }, { post_id });
    return { status: 'fulfilled', response: 'Update successful' };
  } catch (error) {
    return { status: 'rejected', response: 'Server error' };
  }
};
