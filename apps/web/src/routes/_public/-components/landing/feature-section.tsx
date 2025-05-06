import { Mic, BrainCircuit, FileAudio, AudioLines } from 'lucide-react';
import { FeatureCard } from './feature-card';

export function FeaturesSection() {
  const features = [
    {
      icon: <Mic className="h-10 w-10 text-primary" />,
      title: 'Smart Financial Podcasts',
      description:
        'Personalized audio reports from your connected brokerage accounts.',
    },
    {
      icon: <BrainCircuit className="h-10 w-10 text-primary" />,
      title: 'Conversational AI',
      description:
        `Ask questions like "How's my portfolio doing?" or "Am I on track to retire by 50?"`,
    },
    {
      icon: <FileAudio className="h-10 w-10 text-primary" />,
      title: 'Weekly Audio Briefings',
      description: "Automated summaries of your week's performance.",
    },
    {
      icon: <AudioLines className="h-10 w-10 text-primary" />,
      title: 'Voice-First Dashboard',
      description: 'Navigate your finances using voice commands.',
    },
  ];

  return (
    <section className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12 text-foreground">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 lg:gap-16">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}