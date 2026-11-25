import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.join(repositoryRoot, 'Storage', 'LessonTemplate');
const sitemapPath = path.join(repositoryRoot, 'wwwroot', 'sitemap.xml');
const robotsPath = path.join(repositoryRoot, 'wwwroot', 'robots.txt');

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function lessonIdsIn(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    const lessonIds = [];

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'schemas') continue;

        const candidate = path.join(folder, entry.name);
        if (await exists(path.join(candidate, 'LearningPath.json'))) {
            const pathEntries = await readdir(candidate, { withFileTypes: true });
            for (const child of pathEntries) {
                if (!child.isDirectory()) continue;
                const lessonFolder = path.join(candidate, child.name);
                if (await exists(path.join(lessonFolder, 'config.json'))) {
                    lessonIds.push(child.name);
                }
            }
        } else if (await exists(path.join(candidate, 'config.json'))) {
            lessonIds.push(entry.name);
        }
    }

    return [...new Set(lessonIds)].sort();
}

async function configuredBaseUrl() {
    if (process.env.SITEMAP_BASE_URL) return process.env.SITEMAP_BASE_URL;

    const robots = await readFile(robotsPath, 'utf8');
    const sitemapLine = robots.split(/\r?\n/).find(line => /^\s*Sitemap:/i.test(line));
    if (!sitemapLine) throw new Error('robots.txt must contain an absolute Sitemap URL.');

    const sitemapUrl = new URL(sitemapLine.replace(/^\s*Sitemap:\s*/i, '').trim());
    return sitemapUrl.origin;
}

function xmlEscape(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

const baseUrl = (await configuredBaseUrl()).replace(/\/+$/, '');
const lessonIds = await lessonIdsIn(lessonsRoot);
const urls = [
    `${baseUrl}/Account/Terms`,
    ...lessonIds.map(id => `${baseUrl}/Lesson/${encodeURIComponent(id)}`),
];

const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    '</urlset>',
    '',
].join('\n');

await writeFile(sitemapPath, xml, 'utf8');
console.log(`Generated ${sitemapPath} with ${urls.length} URLs (${lessonIds.length} lessons).`);
