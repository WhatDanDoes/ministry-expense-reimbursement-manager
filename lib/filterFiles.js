const fs = require('fs');

const MAX_IMGS = 30;

function filterFiles(files) {
  files = files.filter(file => !(/(^|\/)\.[^\/\.]/g).test(file));
  files = files.map(item => {
    if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(item)) {
      return { file: item, type: 'image' };
    }
    return { file: item, type: 'link' };
  });
  return files.reverse();
}

module.exports = filterFiles;
