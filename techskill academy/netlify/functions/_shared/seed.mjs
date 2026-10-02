/**
 * First-run seeding: courses + admin account (always) and demo data (optional).
 *
 * SEED_DEMO=true  → also seed sample facilitators, students, classes, materials,
 *                   assessments and messages (so portals can be explored instantly).
 *                   The local dev server (server.mjs) sets this automatically.
 * default (unset) → clean start: only the 6 courses and the admin account.
 *                   This is what a fresh Netlify deployment gets — students
 *                   self-sign up at /signup and the admin creates facilitators.
 */
import { db } from './store.mjs';
import { hashPassword } from './auth.mjs';
import { newUserId, newClassId, newMaterialId, newAssessmentId, newMessageId, saveFile, saveUser } from './helpers.mjs';

const COURSES = [
  {
    id: 'cctv',
    code: 'CCTV',
    title: 'CCTV Installation & Maintenance',
    duration: '8 weeks per level',
    icon: 'cctv',
    overview: 'Become a certified CCTV technician. Learn to install, configure and maintain surveillance systems for homes, estates, offices and businesses — from cable runs to remote viewing on a client\u2019s phone.',
  },
  {
    id: 'chw',
    code: 'CHW',
    title: 'Computer Hardware Installation & Repair',
    duration: '8 weeks per level',
    icon: 'hardware',
    overview: 'Master the complete skill of building, upgrading, diagnosing and repairing desktop and laptop computers — one of the most in-demand ICT trades in Nigeria today.',
  },
  {
    id: 'prog',
    code: 'PROG',
    title: 'Programming',
    duration: '10 weeks per level',
    icon: 'code',
    overview: 'Go from your very first line of code to building real websites and applications with HTML, CSS, JavaScript and Python — taught project-first, jargon-free.',
  },
  {
    id: 'data',
    code: 'DATA',
    title: 'Data Analysis',
    duration: '8 weeks per level',
    icon: 'chart',
    overview: 'Turn raw data into insight. Learn Excel, SQL and Power BI to clean, analyse and visualise data, and to build dashboards that drive real business decisions.',
  },
  {
    id: 'net',
    code: 'NET',
    title: 'Networking & System Security',
    duration: '10 weeks per level',
    icon: 'network',
    overview: 'Design, configure and defend computer networks. From cabling and IP addressing to firewalls, hardening and an introduction to ethical hacking.',
  },
  {
    id: 'ict',
    code: 'ICT',
    title: 'General ICT Knowledge',
    duration: '6 weeks per level',
    icon: 'ict',
    overview: 'Essential computer and digital skills for school, work and business — Microsoft Office, internet and email, online safety and modern productivity tools.',
  },
];

export async function ensureSeeded() {
  const already = await db.getJSON('meta:seeded');
  if (already) return;
  const seedFullDemo = process.env.SEED_DEMO === 'true';
  console.log('[seed] first run — creating initial data…');

  // ---- Admin (always created) ----
  const admin = {
    id: newUserId(),
    role: 'admin',
    name: 'Academy Administrator',
    email: 'itsolutionsnoads@gmail.com',
    phone: '08074011416',
    passwordHash: hashPassword('Admin@123'),
    photoKey: null,
    createdAt: new Date().toISOString(),
  };
  await saveUser(admin);

  // ---- Courses (always created) ----
  for (const course of COURSES) {
    await db.setJSON(`course:${course.id}`, { levels: ['Beginner', 'Intermediate', 'Advanced'], ...course });
  }

  if (seedFullDemo) {
    await seedDemoData();
  }

  await db.setJSON('meta:seeded', { at: new Date().toISOString(), demo: seedFullDemo });
  console.log('[seed] done.');
}

async function seedDemoData() {
  const now = new Date().toISOString();

  // ---- Facilitators ----
  const chinedu = {
    id: newUserId(), role: 'facilitator', name: 'Chinedu Okafor',
    email: 'chinedu@techskillacademy.com', phone: '0803 111 2233',
    expertise: 'CCTV, Computer Hardware & General ICT',
    bio: 'CCTV and hardware specialist with 12+ years of field experience installing surveillance systems for homes, estates and businesses across Lagos.',
    passwordHash: hashPassword('Facilitator@123'), photoKey: null, createdAt: now,
  };
  const funmilayo = {
    id: newUserId(), role: 'facilitator', name: 'Funmilayo Adeyemi',
    email: 'funmilayo@techskillacademy.com', phone: '0805 222 3344',
    expertise: 'Programming & Data Analysis',
    bio: 'Software developer and data analyst. She has built web platforms for SMEs and loves turning complete beginners into confident developers.',
    passwordHash: hashPassword('Facilitator@123'), photoKey: null, createdAt: now,
  };
  const adewale = {
    id: newUserId(), role: 'facilitator', name: 'Adewale Johnson',
    email: 'adewale@techskillacademy.com', phone: '0807 333 4455',
    expertise: 'Networking & System Security',
    bio: 'Cisco-certified network engineer (CCNA/CCNP) with over a decade managing enterprise networks and securing systems for banks and fintechs.',
    passwordHash: hashPassword('Facilitator@123'), photoKey: null, createdAt: now,
  };
  for (const f of [chinedu, funmilayo, adewale]) await saveUser(f);

  // ---- Students ----
  const students = [
    { name: 'Emeka Obi', email: 'emeka@student.techskillacademy.com', phone: '0701 234 5678', dob: '2003-04-17', gender: 'Male', address: 'Ewupe Road, Ikorodu, Lagos', guardianName: 'Mr. Peter Obi', guardianPhone: '0803 987 6543' },
    { name: 'Blessing Adesanya', email: 'blessing@student.techskillacademy.com', phone: '0703 345 6789', dob: '2002-11-02', gender: 'Female', address: 'Ginti, Ikorodu, Lagos', guardianName: 'Mrs. Kemi Adesanya', guardianPhone: '0805 876 5432' },
    { name: 'Tunde Bakare', email: 'tunde@student.techskillacademy.com', phone: '0706 456 7890', dob: '2004-01-25', gender: 'Male', address: 'Igbogbo, Ikorodu, Lagos', guardianName: 'Alh. Rasaq Bakare', guardianPhone: '0807 765 4321' },
    { name: 'Aisha Mohammed', email: 'aisha@student.techskillacademy.com', phone: '0709 567 8901', dob: '2003-08-09', gender: 'Female', address: 'Odogunyan, Ikorodu, Lagos', guardianName: 'Mrs. Zainab Mohammed', guardianPhone: '0809 654 3210' },
  ];
  let seq = 0;
  const studentUsers = [];
  for (const s of students) {
    seq += 1;
    const student = {
      id: newUserId(), role: 'student', ...s,
      matricNo: `TSA/2026/${String(seq).padStart(4, '0')}`,
      passwordHash: hashPassword('Student@123'), photoKey: null, createdAt: now,
    };
    await saveUser(student);
    studentUsers.push(student);
  }
  await db.setJSON('meta:matricSeq', seq);

  const [emeka, blessing, tunde, aisha] = studentUsers;

  // ---- Classes ----
  const mkClass = (courseId, level, title, schedule, startDate, endDate, facilitator, enrolled) => ({
    id: newClassId(), courseId, level, title, schedule, startDate, endDate,
    description: '', facilitatorId: facilitator.id, enrolled: enrolled.map((e) => e.id),
    createdAt: now,
  });

  const clsCctvBeg = mkClass('cctv', 'Beginner', 'CCTV Installation — Foundation (Weekday Batch)', 'Mon & Wed · 10:00 AM – 1:00 PM', '2026-09-14', '2026-11-06', chinedu, [emeka, blessing]);
  const clsCctvAdv = mkClass('cctv', 'Advanced', 'CCTV Professional — IP Systems & Analytics (Weekend Batch)', 'Saturdays · 10:00 AM – 2:00 PM', '2026-10-03', '2026-11-28', chinedu, []);
  const clsChwBeg = mkClass('chw', 'Beginner', 'Computer Assembly & Repair — Foundation', 'Tue & Thu · 2:00 PM – 5:00 PM', '2026-09-15', '2026-11-07', chinedu, [tunde]);
  const clsProgBeg = mkClass('prog', 'Beginner', 'Web Development Basics — HTML, CSS & JavaScript', 'Mon & Wed · 2:00 PM – 5:00 PM', '2026-09-14', '2026-11-08', funmilayo, [emeka, aisha]);
  const clsProgInt = mkClass('prog', 'Intermediate', 'Python Programming & Databases', 'Tue & Thu · 10:00 AM – 1:00 PM', '2026-09-15', '2026-11-08', funmilayo, [aisha]);
  const clsDataBeg = mkClass('data', 'Beginner', 'Data Analysis with Excel & Power BI', 'Fridays · 10:00 AM – 2:00 PM', '2026-09-18', '2026-11-13', funmilayo, [blessing]);
  const clsNetBeg = mkClass('net', 'Beginner', 'Networking Fundamentals — CCNA Track', 'Tue & Thu · 4:00 PM – 7:00 PM', '2026-09-15', '2026-11-08', adewale, [emeka]);
  const clsNetInt = mkClass('net', 'Intermediate', 'System Security & Ethical Hacking Basics', 'Saturdays · 2:00 PM – 6:00 PM', '2026-10-03', '2026-11-28', adewale, []);
  const clsIctBeg = mkClass('ict', 'Beginner', 'General ICT & Digital Skills (Weekend Batch)', 'Saturdays · 9:00 AM – 12:00 PM', '2026-09-19', '2026-11-14', chinedu, [tunde, aisha]);

  for (const c of [clsCctvBeg, clsCctvAdv, clsChwBeg, clsProgBeg, clsProgInt, clsDataBeg, clsNetBeg, clsNetInt, clsIctBeg]) {
    await db.setJSON(`class:${c.id}`, c);
  }

  // ---- Materials (real downloadable files) ----
  const mkMaterial = async (cls, title, description, fileName, text) => {
    const rec = await saveFile({ name: fileName, contentType: 'text/markdown', dataBase64: Buffer.from(text).toString('base64') }, cls.facilitatorId);
    await db.setJSON(`material:${newMaterialId()}`, {
      id: newMaterialId(), classId: cls.id, title, description, fileName,
      fileType: rec.contentType, size: rec.size, fileKey: rec.key,
      uploadedBy: cls.facilitatorId, uploadedAt: now,
    });
  };

  await mkMaterial(clsCctvBeg, 'Week 1 — Introduction to CCTV Systems', 'Components, analogue vs IP, and a site-survey exercise around Ikorodu.', 'Week-01-Introduction-to-CCTV-Systems.md',
    '# Week 1 — Introduction to CCTV Systems\n\nWelcome to CCTV Installation & Maintenance (Beginner).\n\nIn this topic we cover:\n- What CCTV is and why it matters for homes and businesses\n- Components of a CCTV system: cameras, DVR/NVR, storage, monitors, power\n- Analogue vs IP cameras — key differences\n- Introduction to site survey\n\nHomework: List 5 places around Ginti/Ikorodu where you can spot CCTV installations and note the camera types used.\n');

  await mkMaterial(clsCctvBeg, 'Week 2 — Camera Types & Selection Guide', 'Dome, bullet, PTZ and IP cameras — and how to choose for each scenario.', 'Week-02-Camera-Types-and-Selection.md',
    '# Week 2 — Camera Types & Selection Guide\n\n- Dome cameras: indoor, discreet, wide angle\n- Bullet cameras: outdoor, long range\n- PTZ cameras: pan-tilt-zoom control rooms\n- IP cameras: PoE, resolutions from 2MP to 8MP\n\nSelection factors: lighting, distance, coverage area, budget and cabling.\n');

  await mkMaterial(clsNetBeg, 'Course Outline — Networking & System Security', 'Full week-by-week outline of the beginner networking track.', 'Networking-Beginner-Course-Outline.md',
    '# Networking & System Security (Beginner) — Outline\n\nWeek 1: Network fundamentals, OSI & TCP/IP models\nWeek 2: Cabling, IP addressing & subnetting\nWeek 3: Switches, routers & VLANs\nWeek 4: Wireless networking\nWeek 5: Firewalls & security basics\nWeek 6: Hardening & incident response\n');

  await mkMaterial(clsProgBeg, 'Getting Started with HTML & CSS', 'Tags, elements, attributes and your first styled page.', 'Getting-Started-with-HTML-and-CSS.md',
    '# Getting Started with HTML & CSS\n\nHTML gives a page its structure; CSS gives it style.\n\n## Your first page\n\n    <!DOCTYPE html>\n    <html>\n      <head><title>My Page</title></head>\n      <body>\n        <h1>Hello, TechSkill Academy!</h1>\n        <p>My first paragraph.</p>\n      </body>\n    </html>\n\nPractice: recreate the page above and change the heading and paragraph.\n');

  // ---- Assessments ----
  const mkAssessment = (cls, title, type, maxScore, dueDate) => {
    const a = { id: newAssessmentId(), classId: cls.id, title, type, maxScore, dueDate, createdBy: cls.facilitatorId, createdAt: now };
    return a;
  };
  const asCctvQuiz = mkAssessment(clsCctvBeg, 'Camera Types Quiz', 'Quiz', 20, '2026-10-05');
  const asCctvSurvey = mkAssessment(clsCctvBeg, 'Site Survey Report', 'Assignment', 30, '2026-10-12');
  const asNetQuiz = mkAssessment(clsNetBeg, 'Network Fundamentals Quiz', 'Quiz', 15, '2026-10-06');
  const asProgPage = mkAssessment(clsProgBeg, 'Build Your First Web Page', 'Assignment', 25, '2026-10-08');
  const asProgProject = mkAssessment(clsProgBeg, 'Personal Portfolio Project', 'Project', 100, '2026-11-15');
  for (const a of [asCctvQuiz, asCctvSurvey, asNetQuiz, asProgPage, asProgProject]) {
    await db.setJSON(`assessment:${a.id}`, a);
  }

  // ---- Submissions & grades ----
  const mkSubmission = async (a, student, content, extra = {}) => {
    const late = a.dueDate ? Date.now() > new Date(a.dueDate + 'T23:59:59').getTime() : false;
    await db.setJSON(`submission:${a.id}:${student.id}`, {
      id: `${a.id}:${student.id}`, assessmentId: a.id, classId: a.classId, studentId: student.id,
      content, fileKey: null, fileName: null, submittedAt: now, late,
      score: null, feedback: null, gradedAt: null, gradedBy: null, ...extra,
    });
  };

  await mkSubmission(asCctvQuiz, emeka,
    '1. Dome cameras are indoor cameras shaped like a dome — discreet and wide-angle.\n2. Bullet cameras are long and cylindrical, used outdoors for long range.\n3. PTZ cameras can pan, tilt and zoom remotely.\n4. IP cameras send data over a network and often use PoE.\n5. A DVR works with analogue cameras while an NVR works with IP cameras.',
    { score: 17, feedback: 'Good work! Revise how PTZ cameras are wired and controlled.', gradedAt: now, gradedBy: chinedu.id });

  await mkSubmission(asCctvQuiz, blessing,
    '1. Dome — indoor. 2. Bullet — outdoor. 3. PTZ — moves. 4. IP — uses network cable. 5. DVR records cameras.',
    { score: 14, feedback: 'Fair attempt — revise resolution vs lens size, and expand your answers.', gradedAt: now, gradedBy: chinedu.id });

  await mkSubmission(asNetQuiz, emeka,
    'The OSI model has 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application. TCP/IP is the protocol suite the internet runs on; IP addressing allows hosts to be identified on a network.');

  await mkSubmission(asProgPage, aisha,
    'I built a page about my hometown with a heading, two paragraphs, a list of my favourite foods, and a picture. I styled it with a background colour and centered the heading.',
    { score: 22, feedback: 'Nice structure and clean CSS. Next time add a favicon and alt text.', gradedAt: now, gradedBy: funmilayo.id });

  // ---- Contact messages ----
  await db.setJSON(`message:${newMessageId()}`, {
    id: newMessageId(), name: 'Ibrahim Yusuf', email: 'ibrahim.yusuf@example.com', phone: '0803 555 0142',
    subject: 'Admissions — CCTV Installation', message: 'Good day. I want to register for the CCTV weekend class. Please let me know the requirements and if instalment payment is allowed.',
    read: false, createdAt: now,
  });
  await db.setJSON(`message:${newMessageId()}`, {
    id: newMessageId(), name: 'Grace Umeh', email: 'grace.umeh@example.com', phone: '0706 555 8871',
    subject: 'Data Analysis enquiry', message: 'Please, is the Data Analysis class suitable for someone with no computer background at all? I am very interested.',
    read: true, createdAt: now,
  });
}
