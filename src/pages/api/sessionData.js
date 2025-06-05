import path from "path";
import fs from "fs";

export default function handler(req, res) {
  const { method } = req;
  const { sessionKey, data } = req.body;

  const filePath = path.join(process.cwd(), "src", "data", `session_${sessionKey}.json`);

  if (method === "POST") {
    // Save session data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(200).json({ message: "Session data saved successfully." });
  } else if (method === "GET") {
    // Check if session data exists
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      res.status(200).json(fileData);
    } else {
      res.status(404).json({ message: "Session data not found." });
    }
  } else {
    res.status(405).json({ message: "Method not allowed." });
  }
}
