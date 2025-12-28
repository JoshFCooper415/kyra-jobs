import { jobData } from './jobData.js';

// State
let jobs = {};
let sectors = {};
let currentSectorId = null;
let currentPair = null;

// Progress
let todayCount = 0;
let totalComparisons = 0;
let dailyTarget = 25;
let lastDate = null;

// Tracking - only track which jobs have been compared
let comparedJobPairs = new Set();
let sectorPreferences = {}; // Track sector interest scores for filtering

// Sector descriptions
const SECTOR_INFO = {
    'Management': 'Planning, directing, and coordinating organizational operations',
    'Business_Financial': 'Business operations, finance, accounting, and analysis',
    'Computer_Mathematical': 'Technology, software development, and data science',
    'Architecture_Engineering': 'Design, development, and technical problem-solving',
    'Life_Physical_Social_Science': 'Scientific research and analysis across various fields',
    'Community_Social_Service': 'Supporting and helping individuals and communities',
    'Legal': 'Law practice, compliance, and legal services',
    'Education_Training': 'Teaching, training, and instructional design',
    'Arts_Design_Entertainment_Media': 'Creative work, design, and media production',
    'Healthcare_Practitioners_Technical': 'Medical professionals and healthcare providers',
    'Healthcare_Support': 'Healthcare assistance and patient support',
    'Protective_Service': 'Public safety, security, and emergency services',
    'Food_Preparation_Serving': 'Food service, preparation, and hospitality',
    'Building_Grounds_Maintenance': 'Facility maintenance, cleaning, and landscaping',
    'Personal_Care_Service': 'Personal services, beauty, and wellness',
    'Sales': 'Sales, retail, and customer-facing roles',
    'Office_Administrative_Support': 'Administrative, clerical, and office work',
    'Farming_Fishing_Forestry': 'Agriculture, forestry, and natural resources',
    'Construction_Extraction': 'Building construction and resource extraction',
    'Installation_Maintenance_Repair': 'Equipment installation, maintenance, and repair',
    'Production': 'Manufacturing, production, and assembly work',
    'Transportation_Material_Moving': 'Transportation, delivery, and logistics'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        await loadProgress();
        updateStats();
        showNextComparison();
    } catch (error) {
        console.error('Error initializing:', error);
        alert('Failed to load data: ' + error.message);
    }
});

// Load jobs and sectors from embedded data
async function loadData() {
    if (!jobData || !jobData.jobs || !jobData.sectors) {
        throw new Error('No job data found');
    }

    jobs = jobData.jobs;
    sectors = jobData.sectors;

    // Initialize Elo scores for jobs only
    Object.values(jobs).forEach(job => {
        if (job) {
            job.score = job.score || 1000;
            job.wins = job.wins || 0;
            job.losses = job.losses || 0;
        }
    });

    // Initialize sector preferences (not rankings, just interest level)
    Object.keys(sectors).forEach(sectorId => {
        if (!sectorPreferences[sectorId]) {
            sectorPreferences[sectorId] = 0; // Neutral preference
        }
    });
}

// Load user progress from localStorage
async function loadProgress() {
    const savedProgress = localStorage.getItem('jobPreferenceProgress');

    if (savedProgress) {
        const progress = JSON.parse(savedProgress);

        todayCount = progress.todayCount || 0;
        totalComparisons = progress.totalComparisons || 0;
        lastDate = progress.lastDate;
        comparedJobPairs = new Set(progress.comparedJobPairs || []);
        sectorPreferences = progress.sectorPreferences || {};
        currentSectorId = progress.currentSectorId || null;

        // Reset daily count if new day
        const today = new Date().toDateString();
        if (lastDate !== today) {
            todayCount = 0;
            lastDate = today;
        }

        // Load job scores (only jobs are ranked)
        if (progress.jobs) {
            Object.keys(progress.jobs).forEach(id => {
                if (jobs[id]) {
                    jobs[id].score = progress.jobs[id].score;
                    jobs[id].wins = progress.jobs[id].wins;
                    jobs[id].losses = progress.jobs[id].losses;
                }
            });
        }
    }
}

// Save progress to localStorage
async function saveProgress() {
    const jobScores = {};
    Object.keys(jobs).forEach(id => {
        jobScores[id] = {
            score: jobs[id].score,
            wins: jobs[id].wins,
            losses: jobs[id].losses
        };
    });

    const progress = {
        todayCount,
        totalComparisons,
        lastDate,
        comparedJobPairs: Array.from(comparedJobPairs),
        sectorPreferences,
        currentSectorId,
        jobs: jobScores
    };

    localStorage.setItem('jobPreferenceProgress', JSON.stringify(progress));
}

// Update stats display
function updateStats() {
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('totalComparisons').textContent = totalComparisons;
}

// Show next comparison
function showNextComparison() {
    // Strategy: Show jobs from sectors the user is most interested in

    // Get all sectors that have jobs
    const sectorsWithJobs = Object.keys(sectors).filter(sectorId => {
        const sector = sectors[sectorId];
        return sector.job_ids && sector.job_ids.length >= 2;
    });

    if (sectorsWithJobs.length === 0) {
        alert('No sectors with enough jobs found');
        return;
    }

    // Get sectors sorted by preference (higher = more interested)
    const sortedSectors = sectorsWithJobs
        .sort((a, b) => (sectorPreferences[b] || 0) - (sectorPreferences[a] || 0));

    // Weight selection toward preferred sectors
    // Top 30% sectors get shown 60% of the time
    const topSectorCount = Math.max(1, Math.floor(sortedSectors.length * 0.3));
    const showTopSector = Math.random() < 0.6;

    let selectedSectors;
    if (showTopSector && sortedSectors.length > topSectorCount) {
        selectedSectors = sortedSectors.slice(0, topSectorCount);
    } else {
        selectedSectors = sortedSectors;
    }

    // Pick a random sector from the selected pool
    currentSectorId = selectedSectors[Math.floor(Math.random() * selectedSectors.length)];

    showJobComparison();
}

// Get jobs from a specific sector
function getJobsFromSector(sectorId) {
    const sector = sectors[sectorId];
    if (!sector || !sector.job_ids) return [];

    return sector.job_ids.filter(jobId => jobs[jobId]);
}

// Calculate similarity between two jobs based on salary, sector, and education
function calculateJobSimilarity(job1, job2) {
    let similarity = 0;

    // Salary similarity (normalized to 0-1 based on % difference)
    const salary1 = parseInt(job1.median_pay_annual) || 0;
    const salary2 = parseInt(job2.median_pay_annual) || 0;
    if (salary1 > 0 && salary2 > 0) {
        const salaryDiff = Math.abs(salary1 - salary2);
        const avgSalary = (salary1 + salary2) / 2;
        const salarySimRatio = 1 - Math.min(salaryDiff / avgSalary, 1);
        similarity += salarySimRatio * 0.4; // 40% weight
    }

    // Sector similarity (same sector = very similar)
    if (job1.sector === job2.sector) {
        similarity += 0.3; // 30% weight
    }

    // Education similarity
    const edu1 = job1.entry_level_education || '';
    const edu2 = job2.entry_level_education || '';
    if (edu1 && edu2) {
        if (edu1 === edu2) {
            similarity += 0.3; // 30% weight
        } else {
            // Partial match for similar education levels
            const eduLevels = ['High school', 'Associate', 'Bachelor', 'Master', 'Doctoral'];
            const level1 = eduLevels.findIndex(e => edu1.includes(e));
            const level2 = eduLevels.findIndex(e => edu2.includes(e));
            if (level1 >= 0 && level2 >= 0) {
                const levelDiff = Math.abs(level1 - level2);
                similarity += (0.3 * (1 - levelDiff / eduLevels.length));
            }
        }
    }

    return similarity;
}

// Get most discriminative job pairs based on current Elo scores and similarity
function getMostDiscriminativePairs(availablePairs, count = 10) {
    // After user has made enough comparisons, prioritize similar jobs with close scores
    if (totalComparisons < 20) {
        // Early stage: show diverse comparisons
        return availablePairs;
    }

    // Score each pair by how discriminative it would be
    const scoredPairs = availablePairs.map(([id1, id2]) => {
        const job1 = jobs[id1];
        const job2 = jobs[id2];

        // Calculate score difference (closer = more discriminative)
        const scoreDiff = Math.abs((job1.score || 1000) - (job2.score || 1000));
        const scoreProximity = 1 / (1 + scoreDiff / 100); // Normalize

        // Calculate job similarity
        const similarity = calculateJobSimilarity(job1, job2);

        // Discriminative pairs are similar jobs with close scores
        const discriminativeScore = (scoreProximity * 0.6) + (similarity * 0.4);

        return {
            pair: [id1, id2],
            score: discriminativeScore
        };
    });

    // Sort by discriminative score and return top candidates
    scoredPairs.sort((a, b) => b.score - a.score);
    return scoredPairs.slice(0, Math.min(count, scoredPairs.length)).map(sp => sp.pair);
}

// Show job comparison
function showJobComparison() {
    if (!currentSectorId || !sectors[currentSectorId]) {
        alert('Invalid sector selected');
        return;
    }

    // Find two random jobs from ALL jobs to compare
    const allJobIds = Object.keys(jobs);

    // Filter to jobs we haven't compared much yet
    const availablePairs = [];
    for (let i = 0; i < allJobIds.length; i++) {
        for (let j = i + 1; j < allJobIds.length; j++) {
            const pairKey = [allJobIds[i], allJobIds[j]].sort().join('_');
            if (!comparedJobPairs.has(pairKey)) {
                availablePairs.push([allJobIds[i], allJobIds[j]]);
            }
        }
    }

    // If all pairs compared, allow re-comparison
    let pair;
    if (availablePairs.length === 0) {
        // Just pick random jobs
        const idx1 = Math.floor(Math.random() * allJobIds.length);
        let idx2 = Math.floor(Math.random() * allJobIds.length);
        while (idx2 === idx1) {
            idx2 = Math.floor(Math.random() * allJobIds.length);
        }
        pair = [allJobIds[idx1], allJobIds[idx2]];
    } else {
        // Prefer showing at least one job from current sector
        const pairsWithCurrentSector = availablePairs.filter(([id1, id2]) => {
            const job1Sector = getSectorIdForJob(id1);
            const job2Sector = getSectorIdForJob(id2);
            return job1Sector === currentSectorId || job2Sector === currentSectorId;
        });

        // Use clustering to get most discriminative pairs
        const pairsToUse = pairsWithCurrentSector.length > 0 ? pairsWithCurrentSector : availablePairs;
        const discriminativePairs = getMostDiscriminativePairs(pairsToUse);
        pair = discriminativePairs[Math.floor(Math.random() * discriminativePairs.length)];
    }

    const [id1, id2] = pair;
    const job1 = jobs[id1];
    const job2 = jobs[id2];

    currentPair = {
        items: [job1, job2],
        ids: [id1, id2],
        sectors: [getSectorIdForJob(id1), getSectorIdForJob(id2)]
    };

    // Display
    document.getElementById('comparisonTitle').textContent = 'Which job appeals to you more?';
    document.getElementById('comparisonSubtitle').textContent = 'Your choices help us learn which fields and roles you prefer';

    document.getElementById('option1Title').textContent = job1.title;
    document.getElementById('option1Description').textContent = job1.description;
    document.getElementById('option1Details').innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Field:</span>
            <span class="detail-value">${job1.sector || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Salary:</span>
            <span class="detail-value">$${parseInt(job1.median_pay_annual || 0).toLocaleString()}/yr</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Education:</span>
            <span class="detail-value">${job1.entry_level_education || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Growth:</span>
            <span class="detail-value">${job1.employment_outlook_percent || 0}%</span>
        </div>
    `;

    document.getElementById('option2Title').textContent = job2.title;
    document.getElementById('option2Description').textContent = job2.description;
    document.getElementById('option2Details').innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Field:</span>
            <span class="detail-value">${job2.sector || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Salary:</span>
            <span class="detail-value">$${parseInt(job2.median_pay_annual || 0).toLocaleString()}/yr</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Education:</span>
            <span class="detail-value">${job2.entry_level_education || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Growth:</span>
            <span class="detail-value">${job2.employment_outlook_percent || 0}%</span>
        </div>
    `;

    setState('comparison');
}

// Helper to get sector ID for a job
function getSectorIdForJob(jobId) {
    const job = jobs[jobId];
    if (!job) return null;

    // Find which sector contains this job
    for (const [sectorId, sector] of Object.entries(sectors)) {
        if (sector.job_ids && sector.job_ids.includes(jobId)) {
            return sectorId;
        }
    }
    return null;
}

// Handle selection
window.selectOption = async function(choice) {
    if (!currentPair) return;

    const winnerIndex = choice - 1;
    const loserIndex = choice === 1 ? 1 : 0;
    const winner = currentPair.items[winnerIndex];
    const loser = currentPair.items[loserIndex];

    // Update job Elo rankings
    const [newWinnerScore, newLoserScore] = calculateElo(winner.score, loser.score);
    winner.score = newWinnerScore;
    loser.score = newLoserScore;
    winner.wins++;
    loser.losses++;

    // Track job pair comparison
    const pairKey = currentPair.ids.sort().join('_');
    comparedJobPairs.add(pairKey);

    // Update sector preferences based on job choices
    // When a job wins, increase its sector's preference slightly
    const winningSector = currentPair.sectors[winnerIndex];
    const losingSector = currentPair.sectors[loserIndex];

    if (winningSector) {
        sectorPreferences[winningSector] = (sectorPreferences[winningSector] || 0) + 1;
    }
    if (losingSector && winningSector !== losingSector) {
        // Decrease losing sector preference slightly (but not below 0)
        sectorPreferences[losingSector] = Math.max(0, (sectorPreferences[losingSector] || 0) - 0.5);
    }

    // Update progress
    todayCount++;
    totalComparisons++;
    updateStats();

    await saveProgress();
    showNextComparison();
};

// Calculate Elo
function calculateElo(winnerScore, loserScore, K = 32) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400));
    const expectedLoser = 1 - expectedWinner;
    return [
        winnerScore + K * (1 - expectedWinner),
        loserScore + K * (0 - expectedLoser)
    ];
}

// Skip
document.getElementById('skipBtn').addEventListener('click', () => {
    showNextComparison();
});

// View results
document.getElementById('viewResultsBtn').addEventListener('click', () => {
    // Get all jobs and filter out any without proper data
    const allJobs = Object.values(jobs).filter(job => job && job.title);
    const sortedJobs = allJobs.sort((a, b) => (b.score || 1000) - (a.score || 1000));

    const html = sortedJobs.map((job, index) => `
        <div class="result-item">
            <div class="result-rank">${index + 1}</div>
            <div class="result-info">
                <h3>${job.title}</h3>
                <p>${job.sector || ''} • $${parseInt(job.median_pay_annual || 0).toLocaleString()}/yr</p>
            </div>
            <div class="result-score">Score: ${Math.round(job.score || 1000)}</div>
        </div>
    `).join('');

    document.getElementById('resultsContainer').innerHTML = html;
    setState('results');
});

// Back to comparison
document.getElementById('backToComparisonBtn').addEventListener('click', () => {
    setState('comparison');
});

// Export
document.getElementById('exportBtn').addEventListener('click', () => {
    const sortedJobs = Object.values(jobs).sort((a, b) => b.score - a.score);
    const csv = [
        'Rank,Job Title,Sector,Score,Median Salary,Education,Growth',
        ...sortedJobs.map((job, i) =>
            `${i+1},"${job.title}","${job.sector}",${Math.round(job.score)},$${job.median_pay_annual},"${job.entry_level_education}",${job.employment_outlook_percent}%`
        )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'job-rankings.csv';
    a.click();
});

// Reset progress (for testing)
document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all progress?')) {
        localStorage.removeItem('jobPreferenceProgress');
        window.location.reload();
    }
});

// Set state
function setState(state) {
    document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));

    if (state === 'comparison') {
        document.getElementById('comparisonState').classList.add('active');
    } else if (state === 'results') {
        document.getElementById('resultsState').classList.add('active');
    } else {
        document.getElementById('loadingState').classList.add('active');
    }
}
