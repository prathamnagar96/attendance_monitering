import React, { useMemo, useState } from "react";

const GRADE_BANDS = [
    { min: 80, grade: "O", points: 10 },
    { min: 70, grade: "A+", points: 9 },
    { min: 60, grade: "A", points: 8 },
    { min: 55, grade: "B+", points: 7 },
    { min: 50, grade: "B", points: 6 },
    { min: 45, grade: "C", points: 5 },
    { min: 40, grade: "P", points: 4 },
    { min: 0, grade: "F", points: 0 },
];

const COMPONENT_PRESETS = {
    theory: [
        { name: "T1", max: 20 },
        { name: "T2", max: 20 },
        { name: "ESE", max: 60 },
    ],
    lab: [
        { name: "TW", max: 25 },
        { name: "P/O", max: 25 },
    ],
    activity: [{ name: "Total", max: 25 }],
};

function getGrade(percentage) {
    return GRADE_BANDS.find((band) => percentage >= band.min) || GRADE_BANDS.at(-1);
}

function createSubject(name, type, credits) {
    return {
        id: `${Date.now()}-${Math.random()}`,
        name,
        type,
        credits,
        // Start every new subject at the minimum passing total: 40%.
        components: COMPONENT_PRESETS[type].map((component) => ({
            ...component,
            obtained: component.max * 0.4,
        })),
    };
}

function SubjectTable({ title, rows, updateSubject, updateComponent, updateSubjectPercentage, removeSubject }) {
    if (rows.length === 0) return null;

    return (
        <section className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
            </div>
            <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead className="bg-gray-100 text-left dark:bg-gray-800 dark:text-gray-200">
                    <tr>
                        <th className="p-3">Course</th>
                        <th className="p-3">Credits</th>
                        {rows[0].components.map((component) => (
                            <th className="p-3" key={component.name}>{component.name} / {component.max}</th>
                        ))}
                        <th className="min-w-44 p-3">Preview %</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Grade</th>
                        <th className="p-3">Points</th>
                        <th className="p-3" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((subject) => (
                        <tr className="border-t border-gray-200 dark:border-gray-800" key={subject.id}>
                            <td className="p-3 font-medium text-gray-900 dark:text-white">{subject.name}</td>
                            <td className="p-3">
                                <select
                                    value={subject.credits}
                                    onChange={(event) => updateSubject(subject.id, { credits: Number(event.target.value) })}
                                    className="rounded border px-2 py-1 dark:bg-gray-800 dark:text-white"
                                >
                                    {[1, 2, 3, 4, 5].map((credit) => <option key={credit} value={credit}>{credit}</option>)}
                                </select>
                            </td>
                            {subject.components.map((component, index) => (
                                <td className="p-3" key={component.name}>
                                    <input
                                        type="number"
                                        min="0"
                                        max={component.max}
                                        value={component.obtained}
                                        onChange={(event) => updateComponent(subject, index, event.target.value)}
                                        className="w-20 rounded border px-2 py-1 dark:bg-gray-800 dark:text-white"
                                    />
                                </td>
                            ))}
                            <td className="p-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round(subject.percentage)}
                                    onChange={(event) => updateSubjectPercentage(subject, Number(event.target.value))}
                                    className="w-32 accent-blue-600"
                                    aria-label={`Preview percentage for ${subject.name}`}
                                />
                                <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{subject.percentage.toFixed(0)}%</span>
                            </td>
                            <td className="whitespace-nowrap p-3">{subject.obtained} / {subject.maximum}</td>
                            <td className="p-3 font-semibold">{subject.grade.grade}</td>
                            <td className="p-3">{subject.grade.points}</td>
                            <td className="p-3">
                                <button type="button" onClick={() => removeSubject(subject.id)} className="text-red-600 hover:text-red-800">Remove</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export function SgpaCalculator() {
    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState("");
    const [newType, setNewType] = useState("theory");
    const [newCredits, setNewCredits] = useState(3);

    const results = useMemo(() => {
        let weightedPoints = 0;
        let totalCredits = 0;
        let obtainedMarks = 0;
        let maximumMarks = 0;

        const rows = subjects.map((subject) => {
            const obtained = subject.components.reduce((sum, component) => sum + component.obtained, 0);
            const maximum = subject.components.reduce((sum, component) => sum + component.max, 0);
            const percentage = maximum ? (obtained / maximum) * 100 : 0;
            const grade = getGrade(percentage);

            weightedPoints += grade.points * subject.credits;
            totalCredits += subject.credits;
            obtainedMarks += obtained;
            maximumMarks += maximum;
            return { ...subject, obtained, maximum, percentage, grade };
        });

        return {
            rows,
            sgpa: totalCredits ? weightedPoints / totalCredits : 0,
            percentage: maximumMarks ? (obtainedMarks / maximumMarks) * 100 : 0,
            totalCredits,
        };
    }, [subjects]);

    const addSubject = () => {
        const name = newSubject.trim();
        if (!name) return;
        setSubjects((current) => [...current, createSubject(name, newType, newCredits)]);
        setNewSubject("");
    };

    const updateSubject = (id, update) => {
        setSubjects((current) => current.map((subject) => (
            subject.id === id ? { ...subject, ...update } : subject
        )));
    };

    const updateComponent = (subject, index, value) => {
        const components = subject.components.map((component, componentIndex) => (
            componentIndex === index
                ? { ...component, obtained: Math.max(0, Math.min(Number(value) || 0, component.max)) }
                : component
        ));
        updateSubject(subject.id, { components });
    };

    const updateSubjectPercentage = (subject, percentage) => {
        const components = subject.components.map((component) => ({
            ...component,
            obtained: Math.round(component.max * percentage / 100),
        }));
        updateSubject(subject.id, { components });
    };

    const removeSubject = (id) => {
        setSubjects((current) => current.filter((subject) => subject.id !== id));
    };

    const theoryRows = results.rows.filter((subject) => subject.type === "theory");
    const labRows = results.rows.filter((subject) => subject.type === "lab");
    const activityRows = results.rows.filter((subject) => subject.type === "activity");

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6 pb-24 dark:bg-black sm:px-6">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Semester results</p>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SGPA Calculator</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">New subjects start at the minimum passing score of 40%. Edit the marks to preview your SGPA.</p>
                </div>

                <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-blue-600 p-4 text-white"><p className="text-xs uppercase">SGPA</p><p className="mt-1 text-3xl font-bold">{results.sgpa.toFixed(2)}</p></div>
                    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900"><p className="text-xs uppercase text-gray-500">Percentage</p><p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{results.percentage.toFixed(2)}%</p></div>
                    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900"><p className="text-xs uppercase text-gray-500">Subjects</p><p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{subjects.length}</p></div>
                    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900"><p className="text-xs uppercase text-gray-500">Credits</p><p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{results.totalCredits}</p></div>
                </section>

                <section className="mb-6 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
                    <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Add subject</h2>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                        <input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSubject()} placeholder="Course name" className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                        <select value={newType} onChange={(event) => setNewType(event.target.value)} className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"><option value="theory">Theory (100)</option><option value="lab">Lab (50)</option><option value="activity">Activity (25)</option></select>
                        <select value={newCredits} onChange={(event) => setNewCredits(Number(event.target.value))} className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white">{[1, 2, 3, 4, 5].map((credit) => <option key={credit} value={credit}>{credit} credit{credit > 1 ? "s" : ""}</option>)}</select>
                        <button type="button" onClick={addSubject} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Add</button>
                    </div>
                </section>

                {results.rows.length === 0 ? (
                    <section className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:bg-gray-900">Add your first subject to enter marks.</section>
                ) : (
                    <div className="space-y-6">
                        <SubjectTable title="Theory Subjects - 100 Marks" rows={theoryRows} updateSubject={updateSubject} updateComponent={updateComponent} updateSubjectPercentage={updateSubjectPercentage} removeSubject={removeSubject} />
                        <SubjectTable title="Laboratory Subjects - 50 Marks" rows={labRows} updateSubject={updateSubject} updateComponent={updateComponent} updateSubjectPercentage={updateSubjectPercentage} removeSubject={removeSubject} />
                        <SubjectTable title="Activity Subjects - 25 Marks" rows={activityRows} updateSubject={updateSubject} updateComponent={updateComponent} updateSubjectPercentage={updateSubjectPercentage} removeSubject={removeSubject} />
                    </div>
                )}

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Grades: O 80+, A+ 70-79, A 60-69, B+ 55-59, B 50-54, C 45-49, P 40-44, F below 40. SGPA = sum of (credits x grade points) / total credits.</p>
            </div>
        </main>
    );
}

export default SgpaCalculator;
