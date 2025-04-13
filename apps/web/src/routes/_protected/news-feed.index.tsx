import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/toggle-group';
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface Source {
  name: string;
  url: string;
}

interface SourceCategory {
  title: string;
  sources: Source[];
}

const sourceCategories: SourceCategory[] = [
  {
    title: 'Financial Institutions',
    sources: [
      { name: 'Fidelity Market Commentary', url: 'https://institutional.fidelity.com/advisors/insights/topics/market-commentary' },
      { name: 'Fidelity Research (Market)', url: 'https://digital.fidelity.com/prgw/digital/research/market' },
      { name: 'Fidelity Research (Sector)', url: 'https://digital.fidelity.com/prgw/digital/research/sector' },
      { name: 'Schwab Market Commentary', url: 'https://www.schwab.com/learn/market-commentary' },
      { name: 'Schwab Asset Management Insights', url: 'https://www.schwabassetmanagement.com/insight/market-commentary' },
      { name: 'Vanguard Markets & Economy', url: 'https://investor.vanguard.com/resources-education/markets-economy' },
      { name: 'Vanguard News & Perspectives', url: 'https://investor.vanguard.com/resources-education/news-perspectives' },
      { name: 'BlackRock Individual Insights', url: 'https://www.blackrock.com/us/individual/insights' },
      { name: 'BlackRock Investment Institute', url: 'https://www.blackrock.com/institutions/en-zz/insights/blackrock-investment-institute/global-weekly-commentary' },
      { name: 'J.P. Morgan Research Insights', url: 'https://www.jpmorgan.com/insights/research' },
      { name: 'J.P. Morgan Markets Research', url: 'https://markets.jpmorgan.com/research-and-insights' },
      { name: 'Goldman Sachs Articles', url: 'https://www.goldmansachs.com/insights/articles' },
      { name: 'Goldman Sachs Markets', url: 'https://www.goldmansachs.com/insights/markets' },
      { name: 'Goldman Sachs Outlooks', url: 'https://www.goldmansachs.com/insights/outlooks' },
      { name: 'Morgan Stanley Investment Management Insights', url: 'https://www.morganstanley.com/im/en-us/individual-investor/insights.html' },
      { name: 'Morgan Stanley Research', url: 'https://www.morganstanley.com/what-we-do/research' },
    ],
  },
  {
    title: 'News Outlets',
    sources: [
      { name: 'Reuters Business & Finance Topics', url: 'https://www.reutersagency.com/en/reutersbest/topics-of-interest/business-and-finance/' },
      { name: 'Reuters Business Finance Coverage', url: 'https://reutersagency.com/content/coverage-expertise/business-finance/' },
      { name: 'Investopedia', url: 'https://www.investopedia.com/' },
      { name: 'MarketWatch', url: 'https://www.marketwatch.com/' },
      { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/' },
      { name: 'Bloomberg', url: 'https://www.bloomberg.com/' },
    ],
  },
  {
    title: 'Blogs & Commentary',
    sources: [
      { name: 'Calculated Risk', url: 'https://www.calculatedriskblog.com/' },
      { name: 'Musings on Markets (Damodaran)', url: 'https://aswathdamodaran.blogspot.com/' },
      { name: 'Damodaran Online', url: 'https://pages.stern.nyu.edu/~adamodar/' },
      { name: 'The Big Picture (Ritholtz)', url: 'https://ritholtz.com/' },
      { name: 'Klement on Investing (CFA Institute)', url: 'https://blogs.cfainstitute.org/investor/author/joachimklement/' },
      { name: 'Of Dollars And Data', url: 'https://ofdollarsanddata.com/' },
      { name: 'Monevator', url: 'https://monevator.com/' },
      { name: 'Financial Samurai', url: 'https://www.financialsamurai.com/' },
      { name: 'A Wealth of Common Sense', url: 'https://awealthofcommonsense.com/' },
      { name: 'Abnormal Returns', url: 'https://abnormalreturns.com/' },
      { name: 'The Reformed Broker', url: 'https://thereformedbroker.com/' },
    ],
  },
];

export const Route = createFileRoute('/_protected/news-feed/')({
  component: NewsFeedPage,
});

function NewsFeedPage() {
  const initialCategory = sourceCategories[0]?.title ?? '';
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  const selectedSources = sourceCategories.find(cat => cat.title === selectedCategory)?.sources ?? [];

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <h1 className="mb-8 text-center text-3xl font-bold text-foreground md:text-4xl">
        Suggested Article Sources
      </h1>

      <div className="mb-8 w-full overflow-x-auto pb-2">
        <ToggleGroup
          type="single"
          defaultValue={initialCategory}
          value={selectedCategory}
          onValueChange={(value: string) => {
            if (value) {
              setSelectedCategory(value);
            }
          }}
          className="inline-flex items-center space-x-2 w-max mx-auto"
        >
          {sourceCategories.map((category) => (
            <ToggleGroupItem
              key={category.title}
              value={category.title}
              aria-label={`Select ${category.title}`}
              className="px-6 py-2 whitespace-nowrap flex-shrink-0"
            >
              {category.title}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {selectedSources.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {selectedSources.map((source) => (
            <a
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block transition-transform duration-200 ease-in-out hover:scale-[1.02]"
              aria-label={`Visit ${source.name} (opens in new tab)`}
            >
              <Card className="h-full bg-card hover:border-primary/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium text-card-foreground">
                    {source.name}
                  </CardTitle>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    Click to visit {source.name}
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground">
          Select a category to view sources.
        </div>
      )}
    </div>
  );
}