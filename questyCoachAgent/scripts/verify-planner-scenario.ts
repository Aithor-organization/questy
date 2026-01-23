import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PlannerAgent } from '../src/core/agents/planner/planner-agent.js';
import type { CurriculumGenerationRequest } from '../src/core/agents/planner/types.js';

// Configuration
const DUMMY_DATA_DIR = path.resolve('../DummyData');

async function loadDummyCourse(filename: string) {
    const content = fs.readFileSync(path.join(DUMMY_DATA_DIR, filename), 'utf-8');
    const course = JSON.parse(content);
    // Remove chapters if present to force parsing lectures string
    if (course.chapters) delete course.chapters;
    return course;
}

async function runAdvancedScenarioTest() {
    console.log('Starting Advanced Scenario Verification (Dynamic Pacing)...');

    // Load actual dummy courses for realism
    // We need 3 subjects. Let's pick from dummy data.
    // Assuming file names: 'course_수학_1_xxxx.json', etc.
    // I will list directory first to pick concrete files, but for now I'll guess or assume file names exist
    // Actually, I'll just load *any* 3 courses and rename their subject for the test.
    const files = fs.readdirSync(DUMMY_DATA_DIR).filter(f => f.endsWith('.json')).slice(0, 3);
    const courses = [];

    const subjects = ['Math', 'English', 'Korean'];

    for (let i = 0; i < 3; i++) {
        const file = files[i];
        if (!file) break;
        const rawContent = JSON.parse(fs.readFileSync(path.join(DUMMY_DATA_DIR, file), 'utf-8'));
        // Handle array wrapper
        const c = Array.isArray(rawContent) ? rawContent[0] : rawContent;

        c.subject = subjects[i]; // Force subject name for constraints
        c.courseName = `${subjects[i]} Course`; // Rename

        // Ensure correct structure for PlannerAgent (expects chapters or lectures string)
        if (c.chapters) delete c.chapters;

        // Truncate lectures for faster LLM testing (avoid timeout)
        let lectures = [];
        try {
            if (typeof c.lectures === 'string') {
                lectures = JSON.parse(c.lectures);
            } else if (Array.isArray(c.lectures)) {
                lectures = c.lectures;
            }
        } catch (e) { }

        if (lectures.length > 5) {
            lectures = lectures.slice(0, 5);
            // Rename lectures to match subject for clearer context to LLM
            lectures = lectures.map((l: any, idx: number) => ({
                ...l,
                title: `${c.subject} Concept Lecture ${idx + 1}`,
                duration: "60:00" // Normalize duration
            }));

            c.lectures = JSON.stringify(lectures);
        }

        courses.push(c);
    }

    if (courses.length < 3) {
        console.error('Not enough dummy files found');
        return;
    }

    console.log('loaded courses:', courses.map(c => c.subject));

    const planner = new PlannerAgent();

    // Scenario:
    // Math: Mon(1), Wed(3), Fri(5)
    // English: Tue(2), Thu(4), Sat(6)
    // Korean: Mon(1), Tue(2), Wed(3)
    // Overlaps: 
    // - Mon: Math + Korean
    // - Tue: English + Korean
    // - Wed: Math + Korean
    // - Thu: English (Focus Day)
    // - Fri: Math (Focus Day)
    // - Sat: English (Focus Day)
    // Time: 2h ~ 6h

    const request: CurriculumGenerationRequest = {
        studentId: 'test-student-adv',
        courses: courses,
        targetDate: '2026-06-30',
        dailyStudyHours: 4, // Average anchor
        minDailyStudyHours: 2,
        maxDailyStudyHours: 6,
        subjectDays: {
            "Math": [1, 3, 5],
            "English": [2, 4, 6],
            "Korean": [1, 2, 3]
        },
        // Add Existing Load (Physics on Wed/Fri)
        existingLoad: [
            // 1/21 (Wed): 3h Physics -> 3h remaining (Max 6h)
            { date: "2026-01-21", totalMinutes: 180, subjects: ["Physics"] },
            // 1/23 (Fri): 3h Physics -> 3h remaining
            { date: "2026-01-23", totalMinutes: 180, subjects: ["Physics"] }
        ],
        includeOt: false,
        options: {
            reviewSettings: { enabled: true, sameDayReview: true, reviewDuration: 15 }
        }
    };

    try {
        console.log('Sending request to PlannerAgent...');
        const result = await planner.generateCurriculum(request);

        if (result.success && result.quests) {
            console.log('\n=== Generation Success ===');
            console.log(`Total Quests: ${result.quests.length}`);

            // Analyze Days
            const days: Record<string, { minutes: number, subjects: Set<string> }> = {};
            result.quests.forEach(q => {
                const date = q.scheduledDate;
                if (!days[date]) days[date] = { minutes: 0, subjects: new Set() };
                days[date].minutes += q.estimatedMinutes;
                days[date].subjects.add(q.subject);
            });

            console.log('\n=== Daily Schedule Analysis ===');
            const sortedDates = Object.keys(days).sort();

            sortedDates.slice(0, 10).forEach(date => {
                const d = days[date];
                const subjectList = Array.from(d.subjects).join(', ');
                const hours = (d.minutes / 60).toFixed(1);

                let type = 'Mixed';
                if (d.subjects.size === 1) type = 'Focus';

                console.log(`[${date}] ${hours}h (${d.minutes}m) - ${subjectList} [${type}]`);
            });
            console.log('...');

            // Save to file for user inspection
            fs.writeFileSync('advanced_scenario_result.json', JSON.stringify(result, null, 2));
            console.log('\nResult saved to advanced_scenario_result.json');

        } else {
            console.error('Generation Failed:', result.message);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

runAdvancedScenarioTest().catch(console.error);
