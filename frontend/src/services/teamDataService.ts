import { fetchWithErrorHandling } from ".";

interface TeamMember {
  name?: string;
  intraLogin: string;
  avatar?: string;
  email?: string;
  location?: string;
  level?: number;
  wallet?: number;
  correctionPoints?: number;
  projects?: any[];
  status?: string;
  poolYear?: string;
  poolMonth?: string;
  github?: string;
}

class TeamDataService {
  private cache: Map<string, { data: TeamMember; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 1 hour
  private teamMembers: TeamMember[] = [
    { intraLogin: "abboudje", github: "https://github.com/abboudje" },
    { intraLogin: "ilymegy", github: "https://github.com/IlyanaMegy" },
    { intraLogin: "macheuk-", github: "https://github.com/Emine-42" },
    { intraLogin: "ngaurama", github: "https://github.com/ngaurama" },
    { intraLogin: "oprosvir", github: "https://github.com/oprosvir" },
  ];

  async getTeamMembers(): Promise<TeamMember[]> {
    const results: TeamMember[] = [];
    const membersToFetch: TeamMember[] = [];

    for (const member of this.teamMembers) {
      const cached = this.cache.get(member.intraLogin);
      
      if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
        results.push(cached.data);
      } else {
        membersToFetch.push(member);
        results.push(member);
      }
    }

    if (membersToFetch.length === 0) {
      console.log("Using cached team data");
      return results;
    }

    console.log(`Fetching data for ${membersToFetch.length} team members`);

    for (const member of membersToFetch) {
      try {
        const response = await fetchWithErrorHandling(
          `/api/auth/oauth/fortytwo/user/${member.intraLogin}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.ok) {
          const userData = await response.json();
          
          const projects = userData.projects_users
            ?.filter((project: any) => project.status === 'finished')
            ?.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            ?.slice(0, 5) || [];
          
          const detailedMember: TeamMember = {
            ...member,
            name: userData.displayname || userData.usual_full_name,
            email: userData.email,
            location: userData.location || 'Unavailable',
            level: userData.cursus_users?.[1]?.level || 0,
            wallet: userData.wallet || 0,
            correctionPoints: userData.correction_point || 0,
            projects: projects,
            avatar: userData.image?.link || member.avatar,
            status: userData.status || 'Unknown',
            poolYear: userData.pool_year,
            poolMonth: userData.pool_month
          };
          
          this.cache.set(member.intraLogin, {
            data: detailedMember,
            timestamp: Date.now()
          });
          
          const index = results.findIndex(m => m.intraLogin === member.intraLogin);
          if (index !== -1) {
            results[index] = detailedMember;
          }
        }
        
        if (membersToFetch.indexOf(member) < membersToFetch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to fetch data for ${member.intraLogin}:`, error);
      }
    }
    
    return results;
  }

  async prefetchTeamData(): Promise<void> {
    try {
      await this.getTeamMembers();
      console.log('Team data prefetched successfully');
    } catch (error) {
      console.error('Failed to prefetch team data:', error);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  saveToLocalStorage(): void {
    const cacheData = {
      cache: Array.from(this.cache.entries()),
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('teamDataCache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }

  loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem('teamDataCache');
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000) {
          this.cache = new Map(cacheData.cache);
        }
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
    }
  }
}

export const teamDataService = new TeamDataService();

teamDataService.loadFromLocalStorage();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    teamDataService.saveToLocalStorage();
  });
}
