import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ public/uploads folder ka absolute path
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Agar folder exist nahi karta to bana do
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR); // ✅ ab files yahan jayengi
    },
    filename: (req, file, cb) => {
        // Unique filename banate hain taake collisions na hon
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

export const upload = multer({ storage });