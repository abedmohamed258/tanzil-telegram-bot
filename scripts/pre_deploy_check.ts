import fs from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Tanzil Bot - Pre-Deployment Health Check');
console.log('=============================================');

const checklist = {
  env: false,
  build: false,
  structure: false,
  modules: false,
};

// 1. Check Environment Variables
console.log('\n1️⃣  Checking Configuration...');
if (fs.existsSync('.env')) {
  console.log('✅ .env file found.');
  const envContent = fs.readFileSync('.env', 'utf-8');
  const requiredVars = ['BOT_TOKEN', 'ADMIN_GROUP_ID'];
  const missing = requiredVars.filter((k) => !envContent.includes(k));

  if (missing.length > 0) {
    console.error(`❌ Missing critical env vars: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    checklist.env = true;
    console.log('✅ Critical variables present.');
  }
} else {
  console.warn(
    '⚠️  .env file NOT found. Ensure environment variables are set in Render Dashboard.',
  );
}

// 2. Check Project Structure
console.log('\n2️⃣  Checking Project Structure...');
const requiredFiles = [
  'src/index.ts',
  'src/bot/services/DownloadService.ts',
  'Dockerfile',
  'package.json',
];

const missingFiles = requiredFiles.filter((f) => !fs.existsSync(f));
if (missingFiles.length > 0) {
  console.error(`❌ Missing core files: ${missingFiles.join(', ')}`);
  process.exit(1);
} else {
  checklist.structure = true;
  console.log('✅ Core file structure intact.');
}

// 3. Test Build (Compilation)
console.log('\n3️⃣  Testing Build (TypeScript Compilation)...');
try {
  // Attempt a dry-run build
  execSync('npm run build', { stdio: 'inherit' });
  checklist.build = true;
  console.log('✅ Build Successful. No TypeScript errors.');
} catch {
  console.error('❌ Build FAILED. Fix TypeScript errors before deploying.');
  process.exit(1);
}

// 4. Verify yt-dlp dependency in Dockerfile
console.log('\n4️⃣  Verifying Deployment Config...');
if (fs.existsSync('Dockerfile')) {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf-8');
  if (dockerfile.includes('yt-dlp') && dockerfile.includes('ffmpeg')) {
    checklist.modules = true;
    console.log('✅ Dockerfile includes yt-dlp and ffmpeg.');
  } else {
    console.error(
      '❌ Dockerfile missing installation steps for yt-dlp or ffmpeg.',
    );
    process.exit(1);
  }
} else {
  console.warn('⚠️  Dockerfile not found. Skipping Docker check.');
}

console.log('\n=============================================');
console.log('🎉 ALL SYSTEMS GO! You are ready to deploy to Render.');
console.log('=============================================');
