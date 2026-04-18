// Student Performance Dashboard - Frontend Logic v3 (Fixed Tabs + Multi-Exam + Mobile)
class StudentDashboard {
    constructor() {
        this.exams = [];
        this.multiExamPreviews = [];
        this.currentPreview = null;
        this.charts = {};
        this.hasSubmitted = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.switchTab('overview');
        this.switchMode('single');
        this.updateMultiExamPreview();
    }

    bindEvents() {
        const singleForm = document.getElementById('singleExamForm');
        const multiForm = document.getElementById('multiExamForm');
        const addSubjectBtn = document.getElementById('addSubject');
        
        singleForm.addEventListener('submit', (e) => this.saveSingleExam(e));
        multiForm.addEventListener('submit', (e) => this.saveMultiExam(e));
        // previewSingle listener removed - merged into saveSingleExam
        document.getElementById('addMultiExam').addEventListener('click', () => this.addMultiExamRow());
        document.getElementById('clearData').addEventListener('click', () => this.clearData());
        addSubjectBtn.addEventListener('click', () => this.addSubjectRow());
        
        // Mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Remove subjects & multi-exam
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-subject')) {
                e.target.closest('.subject-row').remove();
            }
            if (e.target.classList.contains('remove-multi-exam')) {
                const index = parseInt(e.target.dataset.index);
                this.multiExamPreviews.splice(index, 1);
                this.saveMultiData();
                this.updateMultiExamPreview();
            }
        });

        // Sidebar nav sync (Overview, Detailed Overview, AI Insights)
        document.querySelectorAll('nav li a').forEach((link, i) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabs = ['overview', 'detailed-overview', 'insights'];
                this.switchTab(tabs[i]);
            });
        });

        // Mobile sidebar close on outside click
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            if (window.innerWidth <= 1024 && sidebar.classList.contains('open') && 
                !sidebar.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    loadData() {
        const examsData = localStorage.getItem('studentExams');
        if (examsData) {
            this.exams = JSON.parse(examsData);
            // this.updateExamHistory(); // removed as not implemented
        }
        const multiData = localStorage.getItem('multiExamPreviews');
        if (multiData) {
            this.multiExamPreviews = JSON.parse(multiData);
            this.updateMultiExamPreview();
        }
    }

    saveData() {
        localStorage.setItem('studentExams', JSON.stringify(this.exams));
    }

    saveMultiData() {
        localStorage.setItem('multiExamPreviews', JSON.stringify(this.multiExamPreviews));
    }

    collectFormData() {
        const subjects = [];
        document.querySelectorAll('.subject-row').forEach(row => {
            const name = row.querySelector('.subject-name').value.trim();
            const marks = parseFloat(row.querySelector('.subject-marks').value);
            if (name && !isNaN(marks)) {
                subjects.push({ name, marks });
            }
        });

        const dateStr = document.getElementById('examDate').value;
        const examDate = dateStr ? new Date(dateStr) : new Date();
        return {
            name: document.getElementById('studentName').value.trim(),
            subjects,
            attendance: parseFloat(document.getElementById('attendance').value),
            examDate: examDate.toISOString(),
            timestamp: examDate.toISOString()
        };
    }

    validateData(data) {
        if (!data.name) return 'Please enter student name';
        if (data.subjects.length === 0) return 'Please add at least one subject';
        if (isNaN(data.attendance) || data.attendance < 0 || data.attendance > 100) return 'Valid attendance (0-100)';
        if (!data.examDate) return 'Please select exam date';
        for (let s of data.subjects) {
            if (isNaN(s.marks) || s.marks < 0 || s.marks > 100) return 'Valid marks (0-100)';
        }
        return null;
    }

    previewSingle() {
        const data = this.collectFormData();
        const error = this.validateData(data);
        if (error) {
            alert(error);
            return;
        }

        this.currentPreview = data;
        const avg = data.subjects.reduce((sum, s) => sum + s.marks, 0) / data.subjects.length;
        const risk = avg < 40 ? 'High' : avg < 70 ? 'Medium' : 'Low';

        // Update preview on detailed tab
        document.getElementById('previewAvg').textContent = avg.toFixed(1);
        document.getElementById('previewRisk').textContent = risk;
        document.getElementById('previewRisk').style.color = risk === 'Low' ? '#10b981' : risk === 'Medium' ? '#f59e0b' : '#ef4444';
        document.getElementById('singlePreviewSection').style.display = 'block';
        document.getElementById('singleExamSubmit').classList.remove('hidden');
    }

    async saveSingleExam(e) {
        e.preventDefault();
        const data = this.collectFormData();
        const error = this.validateData(data);
        if (error) {
            alert(error);
            return;
        }

        const avg = data.subjects.reduce((sum, s) => sum + s.marks, 0) / data.subjects.length;
        const risk = avg < 40 ? 'High' : avg < 70 ? 'Medium' : 'Low';

        // Update preview on detailed tab
        document.getElementById('previewAvg').textContent = avg.toFixed(1);
        document.getElementById('previewRisk').textContent = risk;
        document.getElementById('previewRisk').style.color = risk === 'Low' ? '#10b981' : risk === 'Medium' ? '#f59e0b' : '#ef4444';
        document.getElementById('singlePreviewSection').style.display = 'block';

        this.exams.unshift(data);
        if (this.exams.length > 20) this.exams = this.exams.slice(0, 20);
        
        this.saveData();
        this.updateCharts();
        await this.getAIInsights(data);
        
        this.hasSubmitted = true;
        document.querySelector('.insight-tabs').classList.remove('hidden');
        
        // Reset form
        document.getElementById('singleExamForm').reset();
        document.getElementById('subjectsContainer').innerHTML = '<h3>Subjects & Marks</h3><div class="subject-row" data-index="0"><input type="text" class="subject-name" placeholder="Subject name" required><input type="number" class="subject-marks" placeholder="Marks (0-100)" min="0" max="100" required><button type="button" class="remove-subject" style="display:none;">Remove</button></div>';
        document.getElementById('examDate').value = '';
        document.getElementById('singlePreviewSection').style.display = 'none';
        this.currentPreview = null;
    }

    async saveMultiExam(e) {
        e.preventDefault();
        
        // Validate all multi exam entries
        const validEntries = [];
        let hasError = false;
        document.querySelectorAll('.multi-exam-row').forEach((row, index) => {
            const name = row.querySelector('.multi-exam-name').value.trim();
            const avg = parseFloat(row.querySelector('.multi-exam-avg').value);
            const time = row.querySelector('.multi-exam-time').value;
            
            if (name && !isNaN(avg) && avg >= 0 && avg <= 100 && time) {
                validEntries.push({ name, avg, time, timestamp: new Date(time).toISOString() });
            } else {
                hasError = true;
            }
        });
        
        if (hasError || validEntries.length === 0) {
            alert('Please fill all multi-exam entries correctly (name, avg 0-100, time)');
            return;
        }
        
        // Save each as separate exam or as batch - here as batch trend data
        validEntries.forEach(entry => {
            const mockExam = {
                name: entry.name,
                subjects: [{name: entry.name, marks: entry.avg}],
                attendance: 95, // default
                timestamp: entry.timestamp
            };
            this.exams.unshift(mockExam);
        });
        
        if (this.exams.length > 20) this.exams = this.exams.slice(0, 20);
        
        this.saveData();
        this.multiExamPreviews = []; // clear previews after save
        this.saveMultiData();
        this.updateMultiExamPreview();
        this.updateCharts();
        
        this.hasSubmitted = true;
        document.querySelector('.insight-tabs').classList.remove('hidden');
        
        alert(`${validEntries.length} multi-exam entries saved successfully!`);
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');

        // Sidebar sync
        document.querySelectorAll('nav li').forEach(li => li.classList.remove('active'));
        const tabIndex = ['overview', 'detailed-overview', 'insights'].indexOf(tab);
        if (tabIndex > -1) {
            const navItems = document.querySelectorAll('nav li');
            if (navItems[tabIndex]) navItems[tabIndex].classList.add('active');
        }

        if (tab === 'detailed-overview') {
            this.updateCharts();
            // Show previews on detailed tab
            if (this.currentPreview) {
                const avg = this.currentPreview.subjects.reduce((sum, s) => sum + s.marks, 0) / this.currentPreview.subjects.length;
                const risk = avg < 40 ? 'High' : avg < 70 ? 'Medium' : 'Low';
                document.getElementById('previewAvg').textContent = avg.toFixed(1);
                document.getElementById('previewRisk').textContent = risk;
                document.getElementById('previewRisk').style.color = risk === 'Low' ? '#10b981' : risk === 'Medium' ? '#f59e0b' : '#ef4444';
                document.getElementById('singlePreviewSection').style.display = 'block';
            }
            this.updateMultiPreviewStats();
        }
        if (tab === 'insights') this.getAIInsights(this.exams[0]);
    }

    switchMode(mode) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        document.getElementById('singleExamSection').style.display = mode === 'single' ? 'block' : 'none';
        document.getElementById('multiExamSection').style.display = mode === 'multi' ? 'block' : 'none';
    }



    updateMultiExamPreview() {
        const container = document.getElementById('multiExamPreviews');
        const countEl = document.getElementById('multiExamCount');
        
        if (countEl) countEl.textContent = `(${this.multiExamPreviews.length} exams)`;
        
        if (this.multiExamPreviews.length === 0) {
            if (container) container.innerHTML = '<div class="history-item empty"><p>No multi-exam entries. Add entries for time-based analysis!</p></div>';
            return;
        }

        if (container) container.innerHTML = this.multiExamPreviews.map((exam, index) => {
            const date = new Date(exam.time).toLocaleString();
            return `
                <div class="history-item multi-exam-row">
                    <input type="text" class="multi-exam-name" value="${exam.name}" placeholder="Exam name">
                    <input type="number" class="multi-exam-avg" value="${exam.avg}" min="0" max="100" step="0.1">
                    <input type="datetime-local" class="multi-exam-time" value="${exam.time}">
                    <button class="remove-multi-exam" data-index="${index}">Remove</button>
                </div>
            `;
        }).join('');

        // Add live update listeners
        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const index = parseInt(input.closest('.multi-exam-row').querySelector('.remove-multi-exam').dataset.index);
                this.multiExamPreviews[index].name = container.querySelectorAll('.multi-exam-name')[index].value;
                this.multiExamPreviews[index].avg = parseFloat(container.querySelectorAll('.multi-exam-avg')[index].value) || 0;
                this.multiExamPreviews[index].time = container.querySelectorAll('.multi-exam-time')[index].value;
                this.saveMultiData();
                this.updateMultiPreviewStats();
                if (this.hasSubmitted) this.updateCharts();
            });
        });

        this.updateMultiPreviewStats();
    }

    addMultiExamRow() {
        this.multiExamPreviews.push({ name: '', avg: 0, time: new Date().toISOString().slice(0,16) });
        this.saveMultiData();
        this.updateMultiExamPreview();
    }

    updateMultiPreviewStats() {
        if (this.multiExamPreviews.length === 0) return;

        const avgs = this.multiExamPreviews.map(e => e.avg).filter(a => a > 0);
        const avgTrend = avgs.length ? avgs.reduce((sum, a) => sum + a, 0) / avgs.length : 0;
        const risk = avgTrend < 40 ? 'High' : avgTrend < 70 ? 'Medium' : 'Low';

        document.getElementById('multiAvgTrend').textContent = isNaN(avgTrend) ? '0' : avgTrend.toFixed(1);
        document.getElementById('multiRisk').textContent = risk;
        document.getElementById('multiRisk').style.color = risk === 'Low' ? '#10b981' : risk === 'Medium' ? '#f59e0b' : '#ef4444';
        document.getElementById('multiPreviewStats').style.display = 'block';
    }

    addSubjectRow() {
        const container = document.getElementById('subjectsContainer');
        const rows = container.querySelectorAll('.subject-row');
        const row = this.createSubjectRow(rows.length);
        container.appendChild(row);
    }

    createSubjectRow(index) {
        const div = document.createElement('div');
        div.className = 'subject-row';
        div.dataset.index = index;
        div.innerHTML = `
            <input type="text" class="subject-name" placeholder="Subject name" required>
            <input type="number" class="subject-marks" placeholder="Marks (0-100)" min="0" max="100" required>
            <button type="button" class="remove-subject">Remove</button>
        `;
        return div;
    }

    clearData() {
        if (confirm('Clear all data (exams + multi-previews)?')) {
            localStorage.removeItem('studentExams');
            localStorage.removeItem('multiExamPreviews');
            this.exams = [];
            this.multiExamPreviews = [];
            this.currentPreview = null;
            if (this.charts.bar) this.charts.bar.destroy();
            if (this.charts.trend) this.charts.trend.destroy();
            if (this.charts.progress) this.charts.progress.destroy();
            this.charts = {};
            this.updateMultiExamPreview();
            document.getElementById('singleExamForm').reset();
            document.getElementById('subjectsContainer').innerHTML = '<h3>Subjects & Marks</h3><div class="subject-row" data-index="0"><input type="text" class="subject-name" placeholder="Subject name" required><input type="number" class="subject-marks" placeholder="Marks (0-100)" min="0" max="100" required><button type="button" class="remove-subject" style="display:none;">Remove</button></div>';
            document.getElementById('singleExamSubmit').classList.add('hidden');
            document.getElementById('singlePreviewSection').style.display = 'none';
            document.getElementById('multiPreviewStats').style.display = 'none';
            this.hasSubmitted = false;
            document.querySelector('.insight-tabs').classList.add('hidden');
        }
    }

    updateCharts() {
        if (this.exams.length === 0 && this.multiExamPreviews.length === 0) {
            document.getElementById('riskLevel').style.display = 'none';
            return;
        }

        // Use latest exam for bar chart, multi-previews for trend
        let latestExam = this.exams[0];
        if (!latestExam && this.multiExamPreviews.length > 0) {
            // Mock subjects for chart from first multi avg
            latestExam = { 
                subjects: [{name: 'Overall', marks: this.multiExamPreviews[0].avg}] 
            };
        }

        if (latestExam && latestExam.subjects) {
            const subjects = latestExam.subjects.map(s => s.name || `Exam ${latestExam.name || 1}`);
            const marks = latestExam.subjects.map(s => s.marks || s.avg);
            Object.values(this.charts).forEach(c => c.destroy());
            this.charts = {};

            const isSingleExam = latestExam && latestExam.subjects && latestExam.subjects.length > 1;
            this.charts.bar = new Chart(document.getElementById('barChart'), {
                type: 'bar',
                data: { labels: subjects.slice(0,10), datasets: [{ label: 'Marks/Avg', data: marks.slice(0,10), backgroundColor: 'rgba(59,130,246,0.8)' }] },
                options: { 
                    responsive: true, 
                    scales: { y: { beginAtZero: true, max: 100 } }, 
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: isSingleExam ? 'Subject-wise Marks (Single Exam)' : 'Performance (Multi Exam)'
                        }
                    }
                }
            });
        }

        // Trend from multiExamPreviews or exams
        let trendData = [...this.multiExamPreviews];
        if (this.exams.length > 0) trendData = trendData.concat(this.exams.slice(0,10).map(e => ({avg: e.subjects.reduce((sum, s) => sum + s.marks, 0) / e.subjects.length, time: e.timestamp})));
        trendData.sort((a, b) => new Date(a.time) - new Date(b.time));
        trendData = trendData.slice(-10);

        const trendAvgs = trendData.map(e => e.avg);
        const trendDates = trendData.map(e => new Date(e.time).toLocaleDateString());

        const hasMultiData = this.multiExamPreviews.some(e => e.avg > 0);
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { 
                labels: trendDates, 
                datasets: [{ label: 'Performance Trend', data: trendAvgs, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }]
            },
            options: { 
                responsive: true, 
                scales: { y: { beginAtZero: true, max: 100 } }, 
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: hasMultiData ? 'Trend Over Time (Multi Exam)' : 'Trend (Single Exams)'
                    }
                }
            }
        });

        // Risk assessment
        const allAvgs = [...trendAvgs, ...(this.exams.map(e => e.subjects.reduce((sum, s) => sum + s.marks, 0) / e.subjects.length))].filter(a => a > 0);
        const overallAvg = allAvgs.reduce((sum, a) => sum + a, 0) / allAvgs.length;
        const overallRisk = overallAvg < 40 ? 'High' : overallAvg < 70 ? 'Medium' : 'Low';

        document.querySelector('#riskLevel .avg').textContent = overallAvg.toFixed(1);
        document.querySelector('#riskLevel .risk-text').textContent = overallRisk;
        document.querySelector('#riskLevel .risk-text').style.color = overallRisk === 'Low' ? '#10b981' : overallRisk === 'Medium' ? '#f59e0b' : '#ef4444';
        document.getElementById('riskLevel').style.display = 'block';

        // Progress chart
        const first = allAvgs[0] || 50;
        const last = allAvgs[allAvgs.length - 1] || 50;
        const improvement = last - first;
        
        this.charts.progress = new Chart(document.getElementById('progressChart'), {
            type: 'doughnut',
            data: {
                labels: ['Improvement', 'Decline', 'Stable'],
                datasets: [{
                    data: [Math.abs(improvement) * (improvement >= 0 ? 1 : 0), 
                           Math.abs(improvement) * (improvement < 0 ? 1 : 0), 
                           100 - Math.abs(improvement)],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Overall Progress (Single + Multi Exams)'
                    }
                }
            }
        });
    }

    async getAIInsights(exam = null) {
        if (!exam && this.exams.length === 0) return;

        const analysisExam = exam || this.exams[0];
        const loading = document.getElementById('loading');
        const errorMsg = document.getElementById('errorMsg');
        const summary = document.getElementById('aiSummary');
        const suggestions = document.getElementById('aiSuggestions');

        loading.style.display = 'block';
        errorMsg.style.display = 'none';

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    studentName: analysisExam.name,
                    subjects: analysisExam.subjects,
                    attendance: analysisExam.attendance,
                    avgMarks: analysisExam.subjects.reduce((sum, s) => sum + s.marks, 0) / analysisExam.subjects.length,
                    examHistoryCount: this.exams.length,
                    multiExamCount: this.multiExamPreviews.length,
                    overallAvg: [ ...this.exams.map(e => e.subjects.reduce((sum, s) => sum + s.marks, 0) / e.subjects.length), ...this.multiExamPreviews.map(e => e.avg) ].reduce((sum, a) => sum + a, 0) / this.exams.length + this.multiExamPreviews.length || 0
                })
            });

            if (!response.ok) throw new Error(await response.text());

            const aiData = await response.json();
            summary.innerHTML = `<strong>Summary:</strong> ${aiData.summary || 'No AI response'}`;
            suggestions.innerHTML = `<strong>Suggestions:</strong> ${aiData.suggestions || 'No suggestions'}`;
        } catch (error) {
            console.error(error);
            errorMsg.textContent = 'AI unavailable - using cached analytics';
            errorMsg.style.display = 'block';
        } finally {
            loading.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StudentDashboard();
});
