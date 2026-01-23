import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const subjects = [
    '국어', '수학', '영어', '한국사',
    '물리학I', '화학I', '생명과학I', '지구과학I',
    '생활과윤리', '윤리와사상', '한국지리', '세계지리',
    '동아시아사', '세계사', '정치와법', '경제', '사회문화'
];

const courses = [];

const subtopicMap = {
    '국어': ['독서', '문학', '화법과 작문', '언어와 매체'],
    '수학': ['수학I', '수학II', '미적분', '기하', '확률과 통계'],
    '영어': ['독해', '구문', '문법', '어휘']
};

subjects.forEach((subject, subIdx) => {
    // 세부 과목이 있는 경우 (국/영/수)
    if (subtopicMap[subject]) {
        const subtopics = subtopicMap[subject];
        subtopics.forEach((subtopic, subTIdx) => {
            // Level 1: 기초, 2: 기본, 3: 심화
            for (let i = 1; i <= 3; i++) {
                let prefix = '';
                if (i === 1) prefix = '기초';
                else if (i === 2) prefix = '기본';
                else prefix = '심화';

                const courseName = `${prefix} ${subtopic}`;

                // 강의 수: 기초는 적게(10~20), 기본/심화는 많게(20~40)
                const minLec = i === 1 ? 10 : 20;
                const maxLec = i === 1 ? 20 : 40;
                const lectureCount = Math.floor(Math.random() * (maxLec - minLec + 1)) + minLec;

                const lectures = [];
                for (let j = 1; j <= lectureCount; j++) {
                    lectures.push({
                        num: j,
                        title: `${courseName} - ${j}강`,
                        duration: Math.floor(Math.random() * 40) + 20 // 20-60 mins
                    });
                }

                courses.push({
                    id: `course_${subject}_${i}_${subtopic}_${Math.random().toString(36).substr(2, 5)}`,
                    // ID에 subtopic 포함하여 유니크성 확보 (하지만 기존 regex 호환을 위해 순서는 유지)
                    // 기존 regex: course_([^_]+)_(\d+)_ 
                    // 테스트 호환성을 위해 ID 포맷 주의: course_국어_1_독서_abcd
                    // Regex: course_([^_]+)_(\d+)_ 는 "국어"와 "1"을 잡고 뒤는 무시하므로 OK.

                    name: courseName,
                    teacher_name: `1타강사_${subject}`,
                    subject: subject,
                    platform: 'megastudy',
                    url: `https://example.com/course/${subIdx}/${subTIdx}/${i}`,
                    chapters: [{
                        num: 1,
                        title: "정규 강의",
                        sections: lectures
                    }],
                    lectures: lectures,
                    lecture_count: lectureCount,
                    total_duration: `${lectureCount * 50}분`,
                    is_completed: false,
                    last_crawled_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        });
    } else {
        // 기타 과목 (기존 로직 유지)
        for (let i = 1; i <= 4; i++) {
            let courseName;
            if (i === 1) {
                courseName = `${subject} 기초 입문`;
            } else if (i === 2) {
                courseName = `${subject} 기본 완성`;
            } else if (i === 3) {
                courseName = `${subject} 심화 문제풀이`;
            } else {
                courseName = `${subject} 파이널 모의고사`;
            }

            const lectureCount = Math.floor(Math.random() * 41) + 10; // 10 to 50
            const lectures = [];

            for (let j = 1; j <= lectureCount; j++) {
                lectures.push({
                    num: j,
                    title: `${courseName} - ${j}강`,
                    duration: Math.floor(Math.random() * 40) + 20
                });
            }

            courses.push({
                id: `course_${subject}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                name: courseName,
                teacher_name: `1타강사_${subject}`,
                subject: subject,
                platform: 'megastudy',
                url: `https://example.com/course/${subIdx}/${i}`,
                chapters: [{
                    num: 1,
                    title: "정규 강의",
                    sections: lectures
                }],
                lectures: lectures,
                lecture_count: lectureCount,
                total_duration: `${lectureCount * 50}분`,
                is_completed: false,
                last_crawled_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
    }
});

const outputDir = path.join(__dirname, '../../../DummyData');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 기존 파일 삭제 (Clean start)
const existingFiles = fs.readdirSync(outputDir);
for (const file of existingFiles) {
    if (file.endsWith('.json') && file.startsWith('course_')) {
        fs.unlinkSync(path.join(outputDir, file));
    }
}

courses.forEach(course => {
    const filename = `${course.id}.json`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(course, null, 2), 'utf8');
});

console.log(`Successfully generated ${courses.length} individual course files in ${outputDir}`);
