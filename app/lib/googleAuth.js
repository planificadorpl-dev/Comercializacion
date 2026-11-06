import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

/**
 * Gets an authenticated Google Sheets client using credentials-datapl.json or credentials.json
 */
export async function getSheetsClient(useDataPL = false) {
  const fileName = useDataPL ? 'credentials-datapl.json' : 'credentials.json';
  let credentialsPath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);
  
  if (!fs.existsSync(credentialsPath)) {
    const altFileName = useDataPL ? 'credentials.json' : 'credentials-datapl.json';
    const alternativePath = path.join(/*turbopackIgnore: true*/ process.cwd(), altFileName);
    if (fs.existsSync(alternativePath)) {
      credentialsPath = alternativePath;
    } else {
      throw new Error('No se encontró archivo de credenciales de Google Sheets en la raíz.');
    }
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  
  return sheets;
}
