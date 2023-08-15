const fileFilter = (req, file, cb) => {
    const allowedFileTypes = ['video/mp4', 'video/mpeg'];
    const maxFileSize = 60000000000; // 60 GB
  
    if (allowedFileTypes.includes(file.type) && file.size <= maxFileSize) {
      cb(null, true);
    } else {
      cb(new MulterError('File is too large'));
    }
  };
  
  export default fileFilter;
  