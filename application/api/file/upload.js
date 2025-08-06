({
  access: 'public',
  method: async ({ fileName, fileBuffer }) => {
    const result = await lib.parser.test();
    console.log({ result });
    try {
      const resourcesPath = node.path.join(application.path, './resources');
      const filePath = node.path.join(resourcesPath, fileName);
      console.log({ fileName, filePath, fileBuffer });

      // Wrap fs.writeFile in a promise for proper async handling
      await new Promise((resolve, reject) => {
        node.fs.writeFile(`./${fileName}`, fileBuffer, 'binary', (err) => {
          if (err) {
            return reject(err); // Reject the promise if there's an error
          }
          resolve();
        });
      });

      return {
        status: 'Stream initialized',
        response: fileName,
      };
    } catch (error) {
      console.error('Error writing file:', error);
      return {
        status: 'Error',
        message: 'Failed to initialize stream',
        error: error.message,
      };
    }
  },
});
