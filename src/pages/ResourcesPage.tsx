import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

/** Videos worth watching alongside practice, played on the page. */
const VIDEOS = [
  { id: '9BywVy2S3ec', title: 'Master SAT grammar' },
  { id: 'khcXLyWCGFU', title: 'Go through every SAT question type' },
  { id: 'e-O4nwVHQ-Y', title: 'The best Desmos guide' },
];

export function ResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link to="/" className="font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline-offset-2 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-3 mb-5 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Resources</h1>

      <div className="flex flex-col gap-4">
        {VIDEOS.map((video) => (
          <Card key={video.id} title={video.title}>
            <div className="aspect-video w-full border-2 border-ink bg-ink">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                title={video.title}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                // YouTube refuses to play an embed that doesn't say which site it's on.
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline-offset-2 hover:underline"
            >
              Watch on YouTube ↗
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
