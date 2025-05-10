// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";
import { 
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJkB_rGyxE5zfx4pFtkOOZQNAcY9lZuok",
  authDomain: "advance-schedule-manager.firebaseapp.com",
  databaseURL: "https://advance-schedule-manager-default-rtdb.firebaseio.com",
  projectId: "advance-schedule-manager",
  storageBucket: "advance-schedule-manager.firebasestorage.app",
  messagingSenderId: "619389494932",
  appId: "1:619389494932:web:20a96899dd7bc954be7681"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Global variables
let scheduleData = {
  semester1: [],
  semester2: [],
  semester3: [],
  semester4: []
};
let lastAction = null;
let charts = {};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initApplication();
});

function initApplication() {
  // Set up authentication state listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User signed in:", user.uid);
      loadFromFirebase(user.uid);
    } else {
      console.log("No user signed in");
      if (loadFromLocalStorage()) {
        showStatus('Schedule data loaded from local storage', 'success');
      }
    }
  });

  // Initialize UI components
  initAuth();
  initTabs();
  initButtons();
  initModals();
  initCalendarViews();
  
  // Calculate and display statistics
  updateStatistics();
  
  // Show welcome message
  showStatus('Welcome to Academic Schedule Manager!', 'info');
  
  // Setup auto-save
  setupAutoSave();
}

// ==================== AUTHENTICATION FUNCTIONS ====================

function initAuth() {
  // Set up auth UI event listeners
  document.getElementById('signInBtn').addEventListener('click', () => handleEmailAuth(false));
  document.getElementById('signUpBtn').addEventListener('click', () => handleEmailAuth(true));
  document.getElementById('googleSignInBtn').addEventListener('click', handleGoogleSignIn);
  
  // Add auth button to toolbar
  const toolbar = document.querySelector('.toolbar');
  const authBtn = document.createElement('button');
  authBtn.id = 'authBtn';
  authBtn.innerHTML = '<i class="fas fa-user"></i> Sign In';
  toolbar.appendChild(authBtn);
  
  authBtn.addEventListener('click', showAuthModal);
  
  // Update auth state
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authBtn.innerHTML = '<i class="fas fa-user"></i> Sign Out';
      authBtn.onclick = handleSignOut;
      document.getElementById('syncData').disabled = false;
    } else {
      authBtn.innerHTML = '<i class="fas fa-user"></i> Sign In';
      authBtn.onclick = showAuthModal;
      document.getElementById('syncData').disabled = true;
    }
  });
}

function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}

function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function showAuthLoading(show) {
  document.getElementById('emailAuth').style.display = show ? 'none' : 'block';
  document.getElementById('authLoading').style.display = show ? 'block' : 'none';
}

async function handleEmailAuth(isSignUp) {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  
  if (!email || !password) {
    showStatus('Please enter both email and password', 'error');
    return;
  }

  showAuthLoading(true);
  
  try {
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, password);
      showStatus('Account created successfully!', 'success');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showStatus('Signed in successfully!', 'success');
    }
    hideAuthModal();
  } catch (error) {
    showStatus(`Authentication failed: ${error.message}`, 'error');
  } finally {
    showAuthLoading(false);
  }
}

async function handleGoogleSignIn() {
  showAuthLoading(true);
  
  try {
    await signInWithPopup(auth, googleProvider);
    showStatus('Google sign-in successful!', 'success');
    hideAuthModal();
  } catch (error) {
    showStatus(`Google sign-in failed: ${error.message}`, 'error');
  } finally {
    showAuthLoading(false);
  }
}

function handleSignOut() {
  signOut(auth).then(() => {
    showStatus('Signed out successfully', 'success');
  }).catch((error) => {
    showStatus(`Sign out failed: ${error.message}`, 'error');
  });
}

// ==================== FIREBASE FUNCTIONS ====================

async function saveToFirebase(userId) {
  const dataToSave = {
    semester1: getTableData('semester1'),
    semester2: getTableData('semester2'),
    semester3: getTableData('semester3'),
    semester4: getTableData('semester4'),
    lastUpdated: serverTimestamp()
  };

  try {
    await set(ref(database, `users/${userId}/scheduleData`), dataToSave);
    console.log('Data saved to Firebase');
    showStatus('Data saved to cloud successfully', 'success');
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    showStatus('Error saving to cloud: ' + error.message, 'error');
    saveToLocalStorage(); // Fallback
  }
}

async function loadFromFirebase(userId) {
  try {
    const snapshot = await get(ref(database, `users/${userId}/scheduleData`));
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      setTableData('semester1', data.semester1 || []);
      setTableData('semester2', data.semester2 || []);
      setTableData('semester3', data.semester3 || []);
      setTableData('semester4', data.semester4 || []);
      
      console.log('Data loaded from Firebase');
      showStatus('Schedule data loaded from cloud', 'success');
      return true;
    } else {
      return loadFromLocalStorage(); // No data in Firebase
    }
  } catch (error) {
    console.error('Error loading from Firebase:', error);
    showStatus('Error loading from cloud: ' + error.message, 'error');
    return loadFromLocalStorage(); // Fallback
  }
}

// ==================== LOCAL STORAGE FUNCTIONS ====================

function saveToLocalStorage() {
  const dataToSave = {
    semester1: getTableData('semester1'),
    semester2: getTableData('semester2'),
    semester3: getTableData('semester3'),
    semester4: getTableData('semester4'),
    lastUpdated: new Date().toISOString()
  };
  
  try {
    localStorage.setItem('academicScheduleData', JSON.stringify(dataToSave));
    console.log('Data saved to localStorage');
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    showStatus('Error saving data: ' + e.message, 'error');
    
    // Handle quota exceeded error
    if (e.name === 'QuotaExceededError') {
      localStorage.clear();
      try {
        localStorage.setItem('academicScheduleData', JSON.stringify(dataToSave));
        showStatus('Storage cleared and data saved', 'info');
      } catch (e2) {
        showStatus('Data too large to save', 'error');
      }
    }
  }
}

function loadFromLocalStorage() {
  try {
    const savedData = localStorage.getItem('academicScheduleData');
    if (savedData) {
      const data = JSON.parse(savedData);
      
      // Verify data structure
      if (data.semester1 && Array.isArray(data.semester1)) {
        setTableData('semester1', data.semester1 || []);
        setTableData('semester2', data.semester2 || []);
        setTableData('semester3', data.semester3 || []);
        setTableData('semester4', data.semester4 || []);
        
        console.log('Data loaded from localStorage');
        if (data.lastUpdated) {
          console.log('Last updated:', new Date(data.lastUpdated).toLocaleString());
        }
        return true;
      }
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
    showStatus('Error loading saved data: ' + e.message, 'error');
  }
  return false;
}

// ==================== UI INITIALIZATION FUNCTIONS ====================

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs and content
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Special handling for different views
      if (tabId === 'calendar') {
        generateMonthlyCalendar();
      } else if (tabId === 'analytics') {
        generateAnalyticsCharts();
      }
    });
  });
}

function initButtons() {
  // Add row button
  document.getElementById('addRow').addEventListener('click', addNewRow);
  
  // Export button
  document.getElementById('exportData').addEventListener('click', () => {
    document.getElementById('exportModal').style.display = 'flex';
  });
  
  // Import button
  document.getElementById('loadData').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  
  document.getElementById('fileInput').addEventListener('change', handleFileImport);
  
  // Repeat last action
  document.getElementById('repeatAction').addEventListener('click', repeatLastAction);
  
  // Sync data
  document.getElementById('syncData').addEventListener('click', syncDataAcrossSemesters);
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'flex';
  });
}

function initModals() {
  // Close modals when clicking X
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').style.display = 'none';
    });
  });
  
  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // Export options
  document.querySelectorAll('.export-option').forEach(option => {
    option.addEventListener('click', () => {
      const exportType = option.getAttribute('data-export');
      handleExport(exportType);
      document.getElementById('exportModal').style.display = 'none';
    });
  });
  
  // Settings modal buttons
  document.getElementById('cancelSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });
  
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
}

// ==================== TABLE FUNCTIONS ====================

function addNewRow() {
  const activeTable = document.querySelector('.tab-content.active table tbody');
  const newRow = createTableRow();
  activeTable.appendChild(newRow);
  
  // Store the action
  lastAction = {
    type: 'add',
    row: newRow
  };
  
  showStatus('New class added successfully', 'success');
  saveData();
  updateStatistics();
}

function createTableRow(data = {}) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="datetime-local" value="${data.datetime || ''}"></td>
    <td><input type="text" value="${data.code || ''}" placeholder="Subject Code"></td>
    <td><input type="text" value="${data.name || ''}" placeholder="Subject Name"></td>
    <td>
      <select>
        <option value="lecture" ${data.type === 'lecture' ? 'selected' : ''}>Lecture</option>
        <option value="lab" ${data.type === 'lab' ? 'selected' : ''}>Lab</option>
        <option value="seminar" ${data.type === 'seminar' ? 'selected' : ''}>Seminar</option>
        <option value="workshop" ${data.type === 'workshop' ? 'selected' : ''}>Workshop</option>
      </select>
    </td>
    <td>
      <select>
        <option value="scheduled" ${data.status === 'completed' ? '' : 'selected'}>Scheduled</option>
        <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
    </td>
    <td class="actions">
      <button class="action-btn repeat-btn" title="Repeat this entry"><i class="fas fa-copy"></i></button>
      <button class="action-btn delete-btn warning" title="Delete this row"><i class="fas fa-trash"></i></button>
    </td>
  `;
  
  // Add event listeners
  row.querySelector('.repeat-btn').addEventListener('click', () => {
    repeatRow(row);
  });
  
  row.querySelector('.delete-btn').addEventListener('click', () => {
    row.remove();
    showStatus('Class deleted successfully', 'success');
    saveData();
    updateStatistics();
    
    // Store the action
    lastAction = {
      type: 'delete',
      row: row
    };
  });
  
  // Add change listeners to save data
  row.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => {
      saveData();
      updateStatistics();
      updateCalendarViews();
    });
  });
  
  return row;
}

function repeatRow(row) {
  const newRow = row.cloneNode(true);
  const inputs = newRow.querySelectorAll('input');
  
  // Clear the inputs in the new row (except buttons)
  inputs.forEach(input => {
    if (input.type !== 'button') {
      input.value = '';
    }
  });
  
  // Reset status to scheduled
  newRow.querySelector('select').value = 'scheduled';
  
  // Insert after the current row
  row.parentNode.insertBefore(newRow, row.nextSibling);
  
  // Store the action
  lastAction = {
    type: 'repeat',
    row: newRow
  };
  
  showStatus('Class duplicated successfully', 'success');
  saveData();
  updateStatistics();
}

function repeatLastAction() {
  if (!lastAction) {
    showStatus('No recent action to repeat', 'error');
    return;
  }
  
  switch (lastAction.type) {
    case 'add':
      const activeTable = document.querySelector('.tab-content.active table tbody');
      const newRow = createTableRow();
      activeTable.appendChild(newRow);
      showStatus('Repeated last action: added new class', 'success');
      break;
      
    case 'delete':
      // Can't repeat delete, so we'll add a new row instead
      addNewRow();
      showStatus('Added new class', 'success');
      break;
      
    case 'repeat':
      repeatRow(lastAction.row);
      break;
  }
  
  saveData();
  updateStatistics();
}

function syncDataAcrossSemesters() {
  const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
  if (!activeTab || activeTab === 'calendar' || activeTab === 'analytics') {
    showStatus('Please select a semester tab to sync from', 'error');
    return;
  }
  
  const activeData = getTableData(activeTab);
  const semesters = ['semester1', 'semester2', 'semester3', 'semester4'].filter(s => s !== activeTab);
  
  semesters.forEach(semester => {
    setTableData(semester, activeData);
  });
  
  showStatus(`Data synchronized from ${activeTab} to all other semesters`, 'success');
  saveData();
  updateStatistics();
}

// ==================== DATA IMPORT/EXPORT FUNCTIONS ====================

function handleExport(type) {
  const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
  
  switch (type) {
    case 'png':
      if (activeTab === 'calendar' || activeTab === 'analytics') {
        exportAsPNG(activeTab);
      } else {
        exportAllAsPNG();
      }
      break;
      
    case 'pdf':
      exportAsPDF();
      break;
      
    case 'json':
      exportAsJSON();
      break;
      
    case 'csv':
      if (activeTab === 'calendar' || activeTab === 'analytics') {
        showStatus('Cannot export this view as CSV', 'error');
      } else {
        exportAllAsCSV();
      }
      break;
      
    case 'ical':
      showStatus('iCal export would be implemented here', 'info');
      break;
      
    case 'print':
      printAllData();
      break;
  }
}

function exportAsPNG(activeTab) {
  let element;
  
  if (activeTab === 'calendar') {
    element = document.getElementById('monthlyCalendar');
  } else if (activeTab === 'analytics') {
    element = document.getElementById('analytics');
  } else {
    element = document.getElementById(activeTab);
  }
  
  if (!element) {
    showStatus('Error: Could not find content to export', 'error');
    return;
  }
  
  // Hide elements that shouldn't be in the screenshot
  const statusMessage = document.getElementById('statusMessage');
  const originalDisplay = statusMessage.style.display;
  statusMessage.style.display = 'none';
  
  // Add temporary styling for better export
  element.style.boxShadow = '0 0 20px rgba(0,0,0,0.1)';
  element.style.borderRadius = '10px';
  element.style.overflow = 'hidden';
  element.style.padding = '20px';
  element.style.backgroundColor = 'white';
  
  html2canvas(element, {
    scale: 2,
    logging: false,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  }).then(canvas => {
    // Restore original display
    statusMessage.style.display = originalDisplay;
    element.style.boxShadow = '';
    element.style.borderRadius = '';
    element.style.overflow = '';
    element.style.padding = '';
    element.style.backgroundColor = '';
    
    // Create download link
    const link = document.createElement('a');
    link.download = `schedule_${activeTab}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    showStatus('Schedule exported as PNG successfully', 'success');
  }).catch(err => {
    statusMessage.style.display = originalDisplay;
    element.style.boxShadow = '';
    element.style.borderRadius = '';
    element.style.overflow = '';
    element.style.padding = '';
    element.style.backgroundColor = '';
    showStatus('Error exporting image: ' + err.message, 'error');
  });
}

function exportAllAsPNG() {
  // Create a temporary container for all data
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.backgroundColor = 'white';
  tempContainer.style.padding = '20px';
  tempContainer.style.maxWidth = '1200px';
  document.body.appendChild(tempContainer);
  
  // Add title
  const title = document.createElement('h1');
  title.textContent = 'Academic Schedule - All Semesters';
  title.style.textAlign = 'center';
  title.style.marginBottom = '20px';
  title.style.color = '#4361ee';
  tempContainer.appendChild(title);
  
  // Process all semesters
  const semesters = ['semester1', 'semester2', 'semester3', 'semester4'];
  
  semesters.forEach(semester => {
    const data = getTableData(semester);
    if (data.length > 0) {
      // Add semester header
      const header = document.createElement('h2');
      header.textContent = semester.toUpperCase().replace('SEMESTER', 'Semester ') + ':';
      header.style.margin = '15px 0 10px 0';
      header.style.color = '#3a0ca3';
      tempContainer.appendChild(header);
      
      // Create table
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginBottom = '30px';
      
      // Add header row
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['Date', 'Time', 'Code', 'Name', 'Type', 'Status'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.padding = '10px';
        th.style.backgroundColor = '#4361ee';
        th.style.color = 'white';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Add data rows
      const tbody = document.createElement('tbody');
      data.forEach(item => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #eee';
        
        const date = item.datetime ? new Date(item.datetime) : null;
        
        // Date cell
        const dateCell = document.createElement('td');
        dateCell.textContent = date ? date.toLocaleDateString() : '';
        dateCell.style.padding = '10px';
        row.appendChild(dateCell);
        
        // Time cell
        const timeCell = document.createElement('td');
        timeCell.textContent = date ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        timeCell.style.padding = '10px';
        row.appendChild(timeCell);
        
        // Code cell
        const codeCell = document.createElement('td');
        codeCell.textContent = item.code || '';
        codeCell.style.padding = '10px';
        row.appendChild(codeCell);
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = item.name || '';
        nameCell.style.padding = '10px';
        row.appendChild(nameCell);
        
        // Type cell
        const typeCell = document.createElement('td');
        typeCell.textContent = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '';
        typeCell.style.padding = '10px';
        row.appendChild(typeCell);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.textContent = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '';
        statusCell.style.padding = '10px';
        row.appendChild(statusCell);
        
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tempContainer.appendChild(table);
    }
  });
  
  // Capture the container as PNG
  html2canvas(tempContainer, {
    scale: 2,
    logging: false,
    useCORS: true,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    // Create download link
    const link = document.createElement('a');
    link.download = `academic_schedule_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Clean up
    document.body.removeChild(tempContainer);
    
    showStatus('All semesters exported as PNG successfully', 'success');
  }).catch(err => {
    document.body.removeChild(tempContainer);
    showStatus('Error exporting image: ' + err.message, 'error');
  });
}

function exportAsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text('Academic Schedule - All Semesters', 14, 15);
  
  // Process all semesters
  const semesters = ['semester1', 'semester2', 'semester3', 'semester4'];
  let yPosition = 25;
  
  semesters.forEach(semester => {
    const data = getTableData(semester);
    if (data.length > 0) {
      // Add semester header
      doc.setFontSize(14);
      doc.text(semester.toUpperCase().replace('SEMESTER', 'Semester ') + ':', 14, yPosition);
      yPosition += 7;
      
      // Prepare table data
      const tableData = data.map(item => {
        const date = item.datetime ? new Date(item.datetime) : null;
        return [
          date ? date.toLocaleDateString() : '',
          date ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
          item.code || '',
          item.name || '',
          item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '',
          item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : ''
        ];
      });
      
      // Add table
      doc.autoTable({
        startY: yPosition,
        head: [['Date', 'Time', 'Code', 'Name', 'Type', 'Status']],
        body: tableData,
        margin: { top: 10 },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [67, 97, 238],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      // Add new page if needed
      if (yPosition > 250 && semester !== 'semester4') {
        doc.addPage();
        yPosition = 20;
      }
    }
  });
  
  // Save the PDF
  doc.save(`academic_schedule_${new Date().toISOString().slice(0,10)}.pdf`);
  showStatus('All semesters exported as PDF successfully', 'success');
}

function printAllData() {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Academic Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #4361ee; text-align: center; }
        h2 { color: #3a0ca3; margin: 25px 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background-color: #4361ee; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        @page { size: auto; margin: 10mm; }
        @media print {
          body { margin: 0; padding: 0; }
          h1 { margin-top: 0; }
        }
      </style>
    </head>
    <body>
      <h1>Academic Schedule - All Semesters</h1>
  `);
  
  // Process all semesters
  const semesters = ['semester1', 'semester2', 'semester3', 'semester4'];
  
  semesters.forEach(semester => {
    const data = getTableData(semester);
    if (data.length > 0) {
      printWindow.document.write(`
        <h2>${semester.toUpperCase().replace('SEMESTER', 'Semester ')}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `);
      
      data.forEach(item => {
        const date = item.datetime ? new Date(item.datetime) : null;
        printWindow.document.write(`
          <tr>
            <td>${date ? date.toLocaleDateString() : ''}</td>
            <td>${date ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</td>
            <td>${item.code || ''}</td>
            <td>${item.name || ''}</td>
            <td>${item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : ''}</td>
            <td>${item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : ''}</td>
          </tr>
        `);
      });
      
      printWindow.document.write(`
          </tbody>
        </table>
      `);
    }
  });
  
  printWindow.document.write(`
    </body>
    </html>
  `);
  
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    showStatus('All semesters prepared for printing', 'success');
  }, 500);
}

function exportAsJSON() {
  const data = {
    semester1: getTableData('semester1'),
    semester2: getTableData('semester2'),
    semester3: getTableData('semester3'),
    semester4: getTableData('semester4'),
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
  };
  
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `academic_schedule_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  
  showStatus('Data exported as JSON successfully', 'success');
}

function exportAllAsCSV() {
  const semesters = ['semester1', 'semester2', 'semester3', 'semester4'];
  let csv = 'Semester,Date,Time,Subject Code,Subject Name,Type,Status\n';
  
  semesters.forEach(semester => {
    const data = getTableData(semester);
    data.forEach(row => {
      const dateTime = row.datetime ? new Date(row.datetime) : null;
      const date = dateTime ? dateTime.toISOString().slice(0,10) : '';
      const time = dateTime ? dateTime.toTimeString().slice(0,5) : '';
      
      csv += `"${semester}","${date}","${time}","${row.code || ''}","${row.name || ''}","${row.type || 'lecture'}","${row.status || 'scheduled'}"\n`;
    });
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `academic_schedule_all_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  
  showStatus('All semesters exported as CSV successfully', 'success');
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate the imported data
      if (!data.semester1 || !Array.isArray(data.semester1)) {
        throw new Error('Invalid file format');
      }
      
      // Load data into each semester table
      setTableData('semester1', data.semester1);
      setTableData('semester2', data.semester2 || []);
      setTableData('semester3', data.semester3 || []);
      setTableData('semester4', data.semester4 || []);
      
      // Save to storage
      saveData();
      
      // Update UI
      updateStatistics();
      updateCalendarViews();
      
      showStatus('Data imported successfully', 'success');
    } catch (error) {
      showStatus('Error importing file: ' + error.message, 'error');
    }
  };
  
  if (file.name.endsWith('.json')) {
    reader.readAsText(file);
  } else {
    showStatus('Only JSON files are supported for import', 'error');
  }
  
  // Reset file input
  e.target.value = '';
}

// ==================== SETTINGS FUNCTIONS ====================

function saveSettings() {
  const theme = document.getElementById('themeSelect').value;
  const timeFormat = document.getElementById('timeFormat').value;
  const firstDayOfWeek = document.getElementById('firstDayOfWeek').value;
  const notifications = document.getElementById('notifications').checked;
  const defaultClassType = document.getElementById('defaultClassType').value;
  
  // Save settings to localStorage
  localStorage.setItem('scheduleSettings', JSON.stringify({
    theme,
    timeFormat,
    firstDayOfWeek,
    notifications,
    defaultClassType
  }));
  
  // Apply theme
  applyTheme(theme);
  
  document.getElementById('settingsModal').style.display = 'none';
  showStatus('Settings saved successfully', 'success');
  
  // Update calendar views with new settings
  updateCalendarViews();
}

function applyTheme(theme) {
  // Remove all theme classes
  document.body.classList.remove(
    'theme-default', 'theme-green', 'theme-purple', 
    'theme-dark', 'theme-red', 'theme-teal', 'theme-orange'
  );
  
  // Add selected theme class
  document.body.classList.add(`theme-${theme}`);
}

// ==================== DATA MANAGEMENT FUNCTIONS ====================

function saveData() {
  const user = auth.currentUser;
  if (user) {
    saveToFirebase(user.uid);
  } else {
    saveToLocalStorage();
  }
}

function getTableData(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return [];
  
  const rows = table.querySelectorAll('tbody tr');
  const data = [];
  
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const selects = row.querySelectorAll('select');
    
    const datetime = inputs[0].value;
    const dateObj = datetime ? new Date(datetime) : null;
    
    data.push({
      datetime: datetime,
      date: dateObj ? dateObj.toISOString() : null,
      code: inputs[1].value,
      name: inputs[2].value,
      type: selects[0] ? selects[0].value : 'lecture',
      status: selects[1] ? selects[1].value : 'scheduled'
    });
  });
  
  return data;
}

function setTableData(tableId, data) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  data.forEach(item => {
    const row = createTableRow(item);
    tbody.appendChild(row);
  });
  
  // Update the scheduleData object
  scheduleData[tableId] = data;
}

// ==================== CALENDAR FUNCTIONS ====================

function initCalendarViews() {
  generateWeeklyCalendar();
  generateMonthlyCalendar();
}

function generateWeeklyCalendar() {
  const calendar = document.getElementById('weeklyCalendar');
  calendar.innerHTML = '';
  
  const now = new Date();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // Only weekdays
  
  // Get all classes from all semesters
  const allClasses = [
    ...getTableData('semester1'),
    ...getTableData('semester2'),
    ...getTableData('semester3'),
    ...getTableData('semester4')
  ];
  
  // Generate days for the current week (Monday to Friday)
  for (let i = 1; i <= 5; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - now.getDay() + i);
    
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = days[i-1] + ' ' + day.getDate();
    
    // Highlight today
    if (day.getDate() === now.getDate() && day.getMonth() === now.getMonth() && day.getFullYear() === now.getFullYear()) {
      dayHeader.style.color = 'var(--primary-color)';
      dayHeader.style.fontWeight = 'bold';
    }
    
    dayElement.appendChild(dayHeader);
    
    // Filter classes for this day
    const dayClasses = allClasses.filter(c => {
      if (!c.datetime || c.status === 'cancelled') return false;
      const classDate = new Date(c.datetime);
      return classDate.getDate() === day.getDate() && 
             classDate.getMonth() === day.getMonth() && 
             classDate.getFullYear() === day.getFullYear();
    });
    
    // Sort by time
    dayClasses.sort((a, b) => {
      return new Date(a.datetime) - new Date(b.datetime);
    });
    
    // Add classes to day
    dayClasses.forEach(cls => {
      const classDate = new Date(cls.datetime);
      const eventElement = document.createElement('div');
      eventElement.className = 'calendar-event';
      
      const timeElement = document.createElement('span');
      timeElement.className = 'event-time';
      
      const timeFormat = document.getElementById('timeFormat')?.value || '24';
      if (timeFormat === '12') {
        timeElement.textContent = classDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        timeElement.textContent = classDate.toTimeString().slice(0,5);
      }
      
      const nameElement = document.createElement('span');
      nameElement.textContent = ' ' + cls.name;
      
      const typeElement = document.createElement('span');
      typeElement.className = 'event-type';
      typeElement.textContent = cls.type;
      
      eventElement.appendChild(timeElement);
      eventElement.appendChild(nameElement);
      eventElement.appendChild(typeElement);
      dayElement.appendChild(eventElement);
    });
    
    calendar.appendChild(dayElement);
  }
}

function generateMonthlyCalendar() {
  const calendar = document.getElementById('monthlyCalendar');
  calendar.innerHTML = '';
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();
  
  // Get all classes from all semesters
  const allClasses = [
    ...getTableData('semester1'),
    ...getTableData('semester2'),
    ...getTableData('semester3'),
    ...getTableData('semester4')
  ];
  
  // Filter classes for this month
  const monthClasses = allClasses.filter(c => {
    if (!c.datetime || c.status === 'cancelled') return false;
    const classDate = new Date(c.datetime);
    return classDate.getMonth() === month && 
           classDate.getFullYear() === year;
  });
  
  // Create calendar header
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const header = document.createElement('div');
  header.style.gridColumn = '1 / -1';
  header.style.textAlign = 'center';
  header.style.fontWeight = 'bold';
  header.style.marginBottom = '10px';
  header.textContent = monthNames[month] + ' ' + year;
  calendar.appendChild(header);
  
  // Create day names header (only weekdays)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  dayNames.forEach(day => {
    const dayElement = document.createElement('div');
    dayElement.style.textAlign = 'center';
    dayElement.style.fontWeight = 'bold';
    dayElement.style.padding = '5px';
    dayElement.textContent = day;
    calendar.appendChild(dayElement);
  });
  
  // Calculate the first Monday
  let firstMonday = 1;
  if (startingDay === 0) { // Sunday
    firstMonday = 2;
  } else if (startingDay > 1) { // Tuesday-Saturday
    firstMonday = 1 + (7 - startingDay + 1);
  }
  
  // Add cells for each day of the month (only weekdays)
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = day;
    
    // Highlight today
    if (day === now.getDate()) {
      dayHeader.style.color = 'var(--primary-color)';
      dayHeader.style.fontWeight = 'bold';
    }
    
    dayElement.appendChild(dayHeader);
    
    // Filter classes for this day
    const dayClasses = monthClasses.filter(c => {
      const classDate = new Date(c.datetime);
      return classDate.getDate() === day;
    });
    
    // Sort by time
    dayClasses.sort((a, b) => {
      return new Date(a.datetime) - new Date(b.datetime);
    });
    
    // Add classes to day
    dayClasses.forEach(cls => {
      const classDate = new Date(cls.datetime);
      const eventElement = document.createElement('div');
      eventElement.className = 'calendar-event';
      
      const timeElement = document.createElement('span');
      timeElement.className = 'event-time';
      
      const timeFormat = document.getElementById('timeFormat')?.value || '24';
      if (timeFormat === '12') {
        timeElement.textContent = classDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        timeElement.textContent = classDate.toTimeString().slice(0,5);
      }
      
      const nameElement = document.createElement('span');
      nameElement.textContent = ' ' + cls.code;
      
      const typeElement = document.createElement('span');
      typeElement.className = 'event-type';
      typeElement.textContent = cls.type;
      
      eventElement.appendChild(timeElement);
      eventElement.appendChild(nameElement);
      eventElement.appendChild(typeElement);
      dayElement.appendChild(eventElement);
    });
    
    calendar.appendChild(dayElement);
  }
}

// ==================== ANALYTICS FUNCTIONS ====================

function generateAnalyticsCharts() {
  // Destroy existing charts if they exist
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  
  // Get all classes from all semesters
  const allClasses = [
    ...getTableData('semester1'),
    ...getTableData('semester2'),
    ...getTableData('semester3'),
    ...getTableData('semester4')
  ];
  
  // Class Type Distribution Chart
  const typeCtx = document.getElementById('classTypeChart').getContext('2d');
  const typeCounts = {
    lecture: allClasses.filter(c => c.type === 'lecture').length,
    lab: allClasses.filter(c => c.type === 'lab').length,
    seminar: allClasses.filter(c => c.type === 'seminar').length,
    workshop: allClasses.filter(c => c.type === 'workshop').length
  };
  
  charts.typeChart = new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: ['Lecture', 'Lab', 'Seminar', 'Workshop'],
      datasets: [{
        data: Object.values(typeCounts),
        backgroundColor: [
          'rgba(67, 97, 238, 0.7)',
          'rgba(247, 37, 133, 0.7)',
          'rgba(76, 201, 240, 0.7)',
          'rgba(255, 90, 95, 0.7)'
        ],
        borderColor: [
          'rgba(67, 97, 238, 1)',
          'rgba(247, 37, 133, 1)',
          'rgba(76, 201, 240, 1)',
          'rgba(255, 90, 95, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        }
      }
    }
  });
  
  // Weekly Pattern Chart
  const weeklyCtx = document.getElementById('weeklyPatternChart').getContext('2d');
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekdayCounts = weekdays.map((_, i) => {
    return allClasses.filter(c => {
      if (!c.datetime) return false;
      const classDate = new Date(c.datetime);
      return classDate.getDay() === i + 1; // Monday=1, Friday=5
    }).length;
  });
  
  charts.weeklyChart = new Chart(weeklyCtx, {
    type: 'bar',
    data: {
      labels: weekdays,
      datasets: [{
        label: 'Classes per day',
        data: weekdayCounts,
        backgroundColor: 'rgba(67, 97, 238, 0.7)',
        borderColor: 'rgba(67, 97, 238, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
  
  // Time Utilization Chart
  const timeCtx = document.getElementById('timeUtilizationChart').getContext('2d');
  const hours = Array.from({length: 24}, (_, i) => i);
  const hourCounts = hours.map(hour => {
    return allClasses.filter(c => {
      if (!c.datetime) return false;
      const classDate = new Date(c.datetime);
      return classDate.getHours() === hour;
    }).length;
  });
  
  charts.timeChart = new Chart(timeCtx, {
    type: 'line',
    data: {
      labels: hours.map(h => `${h}:00`),
      datasets: [{
        label: 'Classes per hour',
        data: hourCounts,
        backgroundColor: 'rgba(247, 37, 133, 0.2)',
        borderColor: 'rgba(247, 37, 133, 1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
  
  // Completion Rate Chart
  const completionCtx = document.getElementById('completionChart').getContext('2d');
  const statusCounts = {
    scheduled: allClasses.filter(c => c.status === 'scheduled').length,
    completed: allClasses.filter(c => c.status === 'completed').length,
    cancelled: allClasses.filter(c => c.status === 'cancelled').length
  };
  
  charts.completionChart = new Chart(completionCtx, {
    type: 'pie',
    data: {
      labels: ['Scheduled', 'Completed', 'Cancelled'],
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          'rgba(67, 97, 238, 0.7)',
          'rgba(76, 201, 240, 0.7)',
          'rgba(255, 90, 95, 0.7)'
        ],
        borderColor: [
          'rgba(67, 97, 238, 1)',
          'rgba(76, 201, 240, 1)',
          'rgba(255, 90, 95, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        }
      }
    }
  });
}

// ==================== STATISTICS FUNCTIONS ====================

function updateStatistics() {
  // Get all classes from all semesters
  const allClasses = [
    ...getTableData('semester1'),
    ...getTableData('semester2'),
    ...getTableData('semester3'),
    ...getTableData('semester4')
  ];
  
  // Calculate statistics
  const totalClasses = allClasses.length;
  const completedClasses = allClasses.filter(c => c.status === 'completed').length;
  
  const now = new Date();
  const upcomingClasses = allClasses.filter(c => {
    if (!c.datetime || c.status !== 'scheduled') return false;
    const classDate = new Date(c.datetime);
    return classDate > now;
  }).length;
  
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  
  const weekClasses = allClasses.filter(c => {
    if (!c.datetime || c.status !== 'scheduled') return false;
    const classDate = new Date(c.datetime);
    return classDate >= weekStart && classDate < weekEnd;
  }).length;
  
  // Update UI
  document.getElementById('totalClasses').textContent = totalClasses;
  document.getElementById('completedClasses').textContent = completedClasses;
  document.getElementById('upcomingClasses').textContent = upcomingClasses;
  document.getElementById('weekClasses').textContent = weekClasses;
  
  // Update calendar views
  updateCalendarViews();
}

// ==================== UTILITY FUNCTIONS ====================

function setupAutoSave() {
  // Save on changes
  document.addEventListener('change', (e) => {
    if (e.target.matches('input, select')) {
      saveData();
    }
  });
  
  // Save when leaving the page
  window.addEventListener('beforeunload', () => {
    saveData();
  });
}

function updateCalendarViews() {
  generateWeeklyCalendar();
  
  // Only update monthly calendar if it's currently visible
  if (document.querySelector('.tab.active').getAttribute('data-tab') === 'calendar') {
    generateMonthlyCalendar();
  }
  
  // Only update analytics if it's currently visible
  if (document.querySelector('.tab.active').getAttribute('data-tab') === 'analytics') {
    generateAnalyticsCharts();
  }
}

function showStatus(message, type) {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = 'status-message ' + type;
  
  // Hide after 5 seconds
  setTimeout(() => {
    statusElement.style.opacity = '0';
    setTimeout(() => {
      statusElement.className = 'status-message';
      statusElement.style.opacity = '1';
    }, 500);
  }, 5000);
}