# Job Preference Finder

A web application that helps users discover their ideal career through intelligent job comparisons using an Elo rating system.

## Features

- **338 Real Jobs**: Comprehensive job data from the Bureau of Labor Statistics
- **23 Career Sectors**: Jobs organized by industry/field
- **Smart Ranking System**: Elo-based algorithm (K=32) learns your preferences
- **Hierarchical Learning**: Tracks sector preferences to show jobs from fields you're interested in
- **Progress Tracking**: Saves all comparisons and rankings to browser localStorage
- **CSV Export**: Export your ranked job list for further analysis

## How It Works

1. **Compare Jobs**: Choose between two jobs at a time based on which appeals to you more
2. **Build Preferences**: The app learns which sectors/fields interest you and shows more jobs from those areas
3. **View Rankings**: See all 338 jobs ranked by your preferences
4. **Export Results**: Download your personalized job rankings as a CSV file

### Ranking Algorithm

- Jobs are ranked using the Elo rating system (same as chess rankings)
- All jobs start at 1000 points
- When you choose a job, it gains points and the other loses points
- The system adapts based on relative scores (upsets = bigger point swings)
- Sector preferences influence which jobs you see more often

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Data Storage**: Browser localStorage (no server required)
- **Hosting**: Netlify
- **Styling**: Custom CSS

## Project Structure

```
kyra-jobs-netlify/
├── public/
│   ├── app.js           # Main application logic
│   ├── index.html       # Single-page application
│   ├── styles.css       # Styling
│   └── jobData.js       # Embedded job and sector data (338 jobs)
├── netlify.toml         # Netlify configuration
├── package.json         # Dependencies
└── README.md           # This file
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Deploy to Netlify:
```bash
npx netlify deploy --prod --dir=public
```

3. Or use Netlify CLI for development:
```bash
npx netlify dev
```

## Deployment

The app is deployed on Netlify at: **https://kyra-jobs.netlify.app**

### Deploy Updates

```bash
npx netlify deploy --prod --dir=public
```

## Data Source

Job data sourced from the U.S. Bureau of Labor Statistics (BLS) Occupational Outlook Handbook.

## License

MIT
