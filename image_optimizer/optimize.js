import imagemin from 'imagemin';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminJpegtran from 'imagemin-jpegtran';
import imageminOptipng from 'imagemin-optipng';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Use yargs to parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('width', {
    alias: 'w',
    type: 'number',
    description: 'Maximum width for resizing images',
    default: 1600, // Default value if -w is not specified
  })
  .help()
  .alias('help', 'h')
  .argv;

// Get the max width from command-line arguments
const maxWidth = argv.width;

const resizeImages = async (inputDir, outputDir) => {
  const files = fs.readdirSync(inputDir);

  for (const file of files) {
    const inputFilePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);

    // Only process image files (jpg, png)
    if (/\.(jpg|jpeg|png)$/i.test(file)) {
      const image = sharp(inputFilePath);

      // Get metadata to check the width
      const metadata = await image.metadata();
      if (metadata.width && metadata.width > maxWidth) {
        // Resize the image if it's wider than maxWidth
        await image.resize(maxWidth).toFile(outputFilePath);
        console.log(`Resized ${file} to ${maxWidth}px width`);
      } else {
        // If the image is not larger than maxWidth, just copy it
        fs.copyFileSync(inputFilePath, outputFilePath);
      }
    } else {
      // Copy non-image files without modification
      fs.copyFileSync(inputFilePath, outputFilePath);
    }
  }
};

(async () => {
  // Resize images in the "src" folder and output to "dist"
  await resizeImages('src', 'dist');

  // Optimize images in the "dist" folder
  await imagemin(['dist/*.{jpg,png,gif}'], {
    destination: 'dist',
    plugins: [
      imageminGifsicle(),
      imageminJpegtran(),
      imageminOptipng()
    ],
  });

  console.log('Images optimized and resized');
})();
