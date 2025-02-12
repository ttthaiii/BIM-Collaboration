import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const BulkUserUpload = () => {
  const [uploadResults, setUploadResults] = useState(null);
  const [errorRows, setErrorRows] = useState([]);

  const downloadTemplate = () => {
    const template = [
      {
        username: 'example_user',
        password: 'password123',
        job_position: 'BIM/Adminsite/PD/PM/PE/OE/SE/FM/CM',
        site_access: '1,2,3',
        email: 'user@example.com'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    // Add validation notes
    ws['A2'] = { v: 'Required: Username must be unique' };
    ws['B2'] = { v: 'Required: Password minimum 6 characters' };
    ws['C2'] = { v: 'Required: Must match one of the positions listed' };
    ws['D2'] = { v: 'Required: Site IDs separated by commas' };
    ws['E2'] = { v: 'Optional: Valid email format' };

    XLSX.writeFile(wb, 'user_upload_template.xlsx');
  };

  const validateRow = (row, index) => {
    const errors = [];
    
    if (!row.username || row.username.length < 3) {
      errors.push(`Row ${index + 1}: Invalid username`);
    }
    
    if (!row.password || row.password.length < 6) {
      errors.push(`Row ${index + 1}: Password too short`);
    }
    
    const validPositions = ['BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM', 'CM'];
    if (!validPositions.includes(row.job_position)) {
      errors.push(`Row ${index + 1}: Invalid job position`);
    }
    
    if (!row.site_access || !row.site_access.match(/^\d+(,\d+)*$/)) {
      errors.push(`Row ${index + 1}: Invalid site access format`);
    }
    
    if (row.email && !row.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push(`Row ${index + 1}: Invalid email format`);
    }
    
    return errors;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const validRows = [];
      const errors = [];

      jsonData.forEach((row, index) => {
        const rowErrors = validateRow(row, index);
        if (rowErrors.length === 0) {
          validRows.push(row);
        } else {
          errors.push(...rowErrors);
        }
      });

      setErrorRows(errors);

      if (validRows.length > 0) {
        try {
          // Send valid rows to server
          const response = await fetch('/admin/bulk-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ users: validRows })
          });

          const result = await response.json();
          setUploadResults({
            success: result.success,
            total: jsonData.length,
            uploaded: validRows.length,
            failed: errors.length
          });
        } catch (error) {
          console.error('Upload error:', error);
          setUploadResults({
            success: false,
            error: 'Failed to upload users'
          });
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Bulk User Upload</h3>
      
      <div className="mb-4">
        <button
          onClick={downloadTemplate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Download Template
        </button>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {uploadResults && (
        <div className={`p-4 rounded ${uploadResults.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h4 className="font-semibold mb-2">Upload Results:</h4>
          <p>Total Rows: {uploadResults.total}</p>
          <p>Successfully Uploaded: {uploadResults.uploaded}</p>
          <p>Failed Rows: {uploadResults.failed}</p>
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 rounded">
          <h4 className="font-semibold mb-2">Validation Errors:</h4>
          <ul className="list-disc pl-4">
            {errorRows.map((error, index) => (
              <li key={index} className="text-red-600">{error}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-600">
            Please correct these errors and upload only the failed rows again.
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkUserUpload;