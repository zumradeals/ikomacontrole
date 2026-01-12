import { useState, useCallback } from 'react';
import { DeploymentType } from '@/hooks/useDeployments';

export interface FrameworkInfo {
  type: DeploymentType;
  name: string;
  description: string;
  detectedFiles: string[];
  suggestedPort: number;
  suggestedStartCommand?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface DetectionResult {
  framework: FrameworkInfo | null;
  isDetecting: boolean;
  error: string | null;
  rawFiles: string[];
}

// Framework detection patterns
const FRAMEWORK_PATTERNS: {
  files: string[];
  framework: Omit<FrameworkInfo, 'detectedFiles'>;
}[] = [
  // Docker Compose
  {
    files: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'],
    framework: {
      type: 'docker_compose',
      name: 'Docker Compose',
      description: 'Stack Docker multi-container détectée',
      suggestedPort: 80,
      confidence: 'high',
    },
  },
  // Dockerfile only
  {
    files: ['Dockerfile'],
    framework: {
      type: 'docker_compose',
      name: 'Docker',
      description: 'Application Dockerisée',
      suggestedPort: 3000,
      confidence: 'medium',
    },
  },
  // Next.js
  {
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    framework: {
      type: 'nodejs',
      name: 'Next.js',
      description: 'Framework React full-stack',
      suggestedPort: 3000,
      suggestedStartCommand: 'npm run start',
      confidence: 'high',
    },
  },
  // Nuxt
  {
    files: ['nuxt.config.js', 'nuxt.config.ts'],
    framework: {
      type: 'nodejs',
      name: 'Nuxt.js',
      description: 'Framework Vue full-stack',
      suggestedPort: 3000,
      suggestedStartCommand: 'npm run start',
      confidence: 'high',
    },
  },
  // Vite / React / Vue / Svelte (static builds)
  {
    files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    framework: {
      type: 'static_site',
      name: 'Vite',
      description: 'Build Vite (React, Vue, Svelte...)',
      suggestedPort: 80,
      confidence: 'high',
    },
  },
  // Angular
  {
    files: ['angular.json'],
    framework: {
      type: 'static_site',
      name: 'Angular',
      description: 'Framework Angular',
      suggestedPort: 80,
      confidence: 'high',
    },
  },
  // Create React App
  {
    files: ['react-scripts'],
    framework: {
      type: 'static_site',
      name: 'Create React App',
      description: 'Application React (CRA)',
      suggestedPort: 80,
      confidence: 'medium',
    },
  },
  // Gatsby
  {
    files: ['gatsby-config.js', 'gatsby-config.ts'],
    framework: {
      type: 'static_site',
      name: 'Gatsby',
      description: 'Site statique Gatsby',
      suggestedPort: 80,
      confidence: 'high',
    },
  },
  // Astro
  {
    files: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
    framework: {
      type: 'static_site',
      name: 'Astro',
      description: 'Framework Astro',
      suggestedPort: 80,
      confidence: 'high',
    },
  },
  // Express / Fastify / NestJS / Node.js API
  {
    files: ['nest-cli.json'],
    framework: {
      type: 'nodejs',
      name: 'NestJS',
      description: 'Framework Node.js NestJS',
      suggestedPort: 3000,
      suggestedStartCommand: 'npm run start:prod',
      confidence: 'high',
    },
  },
  // PHP Laravel
  {
    files: ['artisan', 'composer.json'],
    framework: {
      type: 'docker_compose',
      name: 'Laravel',
      description: 'Framework PHP Laravel',
      suggestedPort: 8000,
      confidence: 'medium',
    },
  },
  // Python Django
  {
    files: ['manage.py', 'requirements.txt'],
    framework: {
      type: 'docker_compose',
      name: 'Django',
      description: 'Framework Python Django',
      suggestedPort: 8000,
      confidence: 'medium',
    },
  },
  // Python FastAPI / Flask
  {
    files: ['requirements.txt', 'main.py'],
    framework: {
      type: 'docker_compose',
      name: 'Python API',
      description: 'Application Python (FastAPI/Flask)',
      suggestedPort: 8000,
      confidence: 'low',
    },
  },
  // Go
  {
    files: ['go.mod'],
    framework: {
      type: 'docker_compose',
      name: 'Go',
      description: 'Application Go',
      suggestedPort: 8080,
      confidence: 'medium',
    },
  },
  // Rust
  {
    files: ['Cargo.toml'],
    framework: {
      type: 'docker_compose',
      name: 'Rust',
      description: 'Application Rust',
      suggestedPort: 8080,
      confidence: 'medium',
    },
  },
  // Ruby on Rails
  {
    files: ['Gemfile', 'config.ru'],
    framework: {
      type: 'docker_compose',
      name: 'Ruby on Rails',
      description: 'Framework Rails',
      suggestedPort: 3000,
      confidence: 'medium',
    },
  },
  // Generic Node.js (package.json must exist)
  {
    files: ['package.json'],
    framework: {
      type: 'nodejs',
      name: 'Node.js',
      description: 'Application Node.js générique',
      suggestedPort: 3000,
      suggestedStartCommand: 'npm start',
      confidence: 'low',
    },
  },
];

// Parse GitHub URL to extract owner and repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle HTTPS URLs
  let match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  // Handle SSH URLs
  match = url.match(/git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

export function useFrameworkDetection() {
  const [result, setResult] = useState<DetectionResult>({
    framework: null,
    isDetecting: false,
    error: null,
    rawFiles: [],
  });

  const detectFramework = useCallback(async (repoUrl: string, branch: string = 'main') => {
    if (!repoUrl) {
      setResult({ framework: null, isDetecting: false, error: 'URL du repository requise', rawFiles: [] });
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setResult({ framework: null, isDetecting: false, error: 'URL GitHub invalide', rawFiles: [] });
      return;
    }

    setResult(prev => ({ ...prev, isDetecting: true, error: null }));

    try {
      // Use GitHub API to get repository tree
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository ou branche non trouvé');
        }
        if (response.status === 403) {
          throw new Error('Limite API GitHub atteinte, réessayez plus tard');
        }
        throw new Error(`Erreur GitHub API: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract file paths from tree
      const files: string[] = data.tree
        ?.filter((item: { type: string }) => item.type === 'blob')
        ?.map((item: { path: string }) => item.path) || [];

      // Extract just filenames for matching
      const filenames = files.map((f: string) => f.split('/').pop() || f);

      // Try to match frameworks in priority order
      let matchedFramework: FrameworkInfo | null = null;
      
      for (const pattern of FRAMEWORK_PATTERNS) {
        const matchingFiles = pattern.files.filter(pf => 
          filenames.includes(pf) || 
          files.some((f: string) => f.endsWith(`/${pf}`) || f === pf)
        );
        
        if (matchingFiles.length > 0) {
          // Special case: check for react-scripts in package.json
          if (pattern.files.includes('react-scripts')) {
            // This would require reading package.json content, skip for now
            continue;
          }
          
          matchedFramework = {
            ...pattern.framework,
            detectedFiles: matchingFiles,
          };
          break;
        }
      }

      setResult({
        framework: matchedFramework,
        isDetecting: false,
        error: null,
        rawFiles: files.slice(0, 50), // Store first 50 files for display
      });
    } catch (error) {
      console.error('Framework detection error:', error);
      setResult({
        framework: null,
        isDetecting: false,
        error: error instanceof Error ? error.message : 'Erreur de détection',
        rawFiles: [],
      });
    }
  }, []);

  const reset = useCallback(() => {
    setResult({
      framework: null,
      isDetecting: false,
      error: null,
      rawFiles: [],
    });
  }, []);

  return {
    ...result,
    detectFramework,
    reset,
  };
}
