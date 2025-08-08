async ({
  startIndex = 0,
  limit = 9,
  order = 'desc',
  userId = null,
  category = null,
  slug = null,
  postId = null,
  searchTerm = null,
}) => {
  const values = [
    startIndex,
    limit,
    order,
    userId,
    category,
    slug,
    postId,
    searchTerm,
  ];

  // console.log({ values, postId });

  try {
    const { get } = await lib.repository;

    const query = `
      SELECT * FROM get_posts($1, $2, $3, $4, $5, $6, $7, $8)`;

    const entity = await get(query);
    const posts = await entity(values);

    return posts;
  } catch (error) {
    throw new Error('Error executing in domain get posts', error);
  }
};
