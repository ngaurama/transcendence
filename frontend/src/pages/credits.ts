import { fetchWithErrorHandling } from '../services';

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

interface ChecklistItem {
  module: string;
  type: string;
  status: boolean;
}

export async function creditsPage(): Promise<string> {
  try {
    const teamMembers: TeamMember[] = [
      { intraLogin: "abboudje", github: "https://github.com/abboudje"},
      { intraLogin: "ilymegy", github: "https://github.com/IlyanaMegy"},
      { intraLogin: "macheuk-", github: "https://github.com/Emine-42"},
      { intraLogin: "ngaurama", github: "https://github.com/ngaurama"},
      { intraLogin: "oprosvir", github: "https://github.com/oprosvir"},
    ];

    let checklistData: ChecklistItem[] = [];
    let majorTotal = { required: 0, completed: 0 };
    let minorTotal = { required: 0, completed: 0 };

    try {
      const response = await fetch('/ft_transcendence_checklist.csv');
      if (response.ok) {
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values = line.split(',').map(v => v.trim());
          
          if (values[0].includes('TOTAL MAJOR')) {
            majorTotal.required = parseInt(values[1]) || 0;
            majorTotal.completed = parseInt(values[2]) || 0;
          } else if (values[0].includes('TOTAL MINOR')) {
            minorTotal.required = parseInt(values[1]) || 0;
            minorTotal.completed = parseInt(values[2]) || 0;
          } else if (values.length >= 3) {
            checklistData.push({
              module: values[0],
              type: values[1],
              status: values[2].toUpperCase() === 'TRUE',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading checklist data:', error);
    }

    const membersWithDetails: TeamMember[] = [];

    for (const member of teamMembers) {
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
            
            membersWithDetails.push({
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
            });
            } else {
                membersWithDetails.push(member);
            }
            
            if (teamMembers.indexOf(member) < teamMembers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`Failed to fetch data for ${member.intraLogin}:`, error);
            membersWithDetails.push(member);
        }
    }


    return `
      <div class="glass-card max-w-6xl mx-auto">
        <!-- Back Arrow -->
        <div class="mb-4">
            <button onclick="navigateBack()" class="flex items-center text-gray-400 hover:text-white transition-colors">
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
            </button>
        </div>

        <div class="mt-12 text-center">
          <h2 class="text-3xl font-bold text-center mt-8 mb-8 underline">About the project</h2>
          <p class="text-gray-300 mb-6 max-w-2xl mx-auto">
            ft_transcendence is a full-stack web application featuring real-time Pong gameplay, tournaments, 
            and social features built for the 42 School curriculum.
          </p>

          <div class="flex justify-center space-x-4">
            <a href="https://github.com/ngaurama/transcendence_basic" 
               target="_blank" 
               class="glass-button bg-blue-700 border-2 border-solid border-gray-300 px-6 py-3 flex items-center">
              GitHub Repo
            </a>
            <button id="toggleChecklist" class="glass-button bg-blue-700 px-4 py-2 text-sm">
              Show Module Checklist
            </button>
          </div>
        </div>

        <!-- Project Requirements Checklist -->
        <div class="mt-8 mb-12">          
          <div id="checklistContent" class="hidden glass-card p-6">
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left text-gray-300">
                <thead class="text-xs uppercase bg-gray-700 text-gray-400">
                  <tr>
                    <th class="px-4 py-3">Module</th>
                    <th class="px-4 py-3">Type</th>
                    <th class="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${checklistData.map(item => `
                    <tr class="border-b border-gray-700">
                      <td class="px-4 py-3 font-medium">${item.module}</td>
                      <td class="px-4 py-3">
                        <span class="${item.type === 'Major' ? 'text-red-400' : 'text-blue-400'}">
                          ${item.type}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center">
                          ${item.status ? `
                            <span class="text-green-500 mr-2">✓</span>
                            <span class="text-green-400">Completed</span>
                          ` : `
                            <span class="text-red-500 mr-2">✗</span>
                            <span class="text-red-400">Not Completed</span>
                          `}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                  
                  <!-- Summary Rows -->
                  <tr class="bg-gray-800 font-bold">
                    <td class="px-4 py-3">TOTAL MAJOR:</td>
                    <td class="px-4 py-3">${majorTotal.required}</td>
                    <td class="px-4 py-3 flex justify-start text-green-400">
                      ${majorTotal.completed}
                    </td>
                  </tr>
                  <tr class="bg-gray-800 font-bold">
                    <td class="px-4 py-3">TOTAL MINOR:</td>
                    <td class="px-4 py-3">${minorTotal.required}</td>
                    <td class="px-4 py-3 flex justify-start text-green-400">
                      ${minorTotal.completed}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="mt-4 grid grid-cols-3 gap-4 text-center">
              <div class="glass-card p-3">
                <div class="text-lg font-semibold text-green-400">
                  ${majorTotal.completed}/${majorTotal.required}
                </div>
                <div class="text-sm text-gray-400">Major Modules</div>
              </div>
              <div class="glass-card p-3">
                <div class="text-lg font-semibold text-green-400">
                  ${minorTotal.completed}/${minorTotal.required}
                </div>
                <div class="text-sm text-gray-400">Minor Modules</div>
              </div>
              <div class="glass-card p-3">
                <div class="text-lg font-semibold text-green-400">
                  ${minorTotal.completed + majorTotal.completed}/27
                </div>
                <div class="text-sm text-gray-400">Overall</div>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t-2 border-gray-700 w-3/4 mx-auto my-4"></div>
        <h3 class="text-2xl font-bold text-center mt-8 mb-8">The Team: ft_suicide_squad</h3>
        <div class="flex flex-col space-y-6">
        ${membersWithDetails.map(member => `
            <div class="glass-card p-6 hover:scale-105 transition-transform duration-300 cursor-pointer member-card relative" data-login="${member.intraLogin}">
            <div class="flex flex-row">
                <!-- Avatar -->
                <img src="${member.avatar}" alt="${member.name}" 
                    class="w-24 h-24 rounded-full border-4 border-gray-600 object-cover flex-shrink-0"
                    onerror="this.src='/avatars/default.png'">
                
                <!-- Info -->
                <div class="ml-6 flex-grow">
                <h3 class="text-xl font-semibold">${member.name}</h3>
                <p class="text-gray-300">@${member.intraLogin}</p>
                ${member.location ? `<p class="text-sm text-gray-400 mt-1">${member.location}</p>` : ''}

                <div class="mt-4 flex flex-wrap gap-2 text-sm">
                    ${member.level ? `<div class="glass-card bg-gray-700 px-3 py-1 rounded">Level: ${member.level.toFixed(2)}</div>` : ''}
                    ${member.wallet !== undefined ? `<div class="glass-card bg-gray-700 px-3 py-1 rounded">Wallet: ${member.wallet} ₳</div>` : ''}
                    ${member.correctionPoints !== undefined ? `<div class="glass-card bg-gray-700 px-3 py-1 rounded">Correction: ${member.correctionPoints}</div>` : ''}
                </div>
                </div>
            </div>

            <!-- Social Buttons (Bottom right) -->
            <div class="absolute bottom-4 right-4 flex space-x-2">
                <a href="https://profile.intra.42.fr/users/${member.intraLogin}" target="_blank"
                class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium">
                42 Profile
                </a>
                ${member.github ? `
                <a href="${member.github}" target="_blank"
                    class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 transition-colors text-white text-sm font-medium">
                    GitHub Account
                </a>
                ` : ''}
            </div>
              
              <!-- Projects Dropdown (Full width) -->
              ${member.projects && member.projects.length > 0 ? `
                <div id="projects-${member.intraLogin}" class="mt-4 hidden w-full">
                  <div class="border-t border-gray-700 pt-4">
                    <h4 class="text-md font-semibold text-gray-300 mb-3">Recent Projects</h4>
                    <div class="space-y-2">
                      ${member.projects.map(p => `
                        <div class="glass-card bg-gray-800 p-3 rounded">
                          <div class="font-medium">${p.project.name}</div>
                          <div class="flex justify-between mt-2 text-sm">
                            <span class="${p.final_mark >= 100 ? 'text-green-400' : p.final_mark >= 75 ? 'text-yellow-400' : 'text-red-400'}">
                              ${p.final_mark !== null ? p.final_mark : 'N/A'}%
                            </span>
                            <span class="text-gray-500">${new Date(p.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading credits page:', error);
    return `
      <div class="glass-card max-w-2xl mx-auto text-center">
        <h2 class="text-2xl font-bold mb-4">Credits</h2>
        <p class="text-gray-300 mb-4">Unable to load team information at this time.</p>
        <p class="text-sm text-gray-400 mb-6">This feature requires backend API integration with 42's API.</p>
        <button onclick="navigate('/')" class="glass-button bg-blue-600 px-4 py-2">
          Back to Home
        </button>
      </div>
    `;
  }
}

export function attachCreditsListeners() {
    const memberCards = document.querySelectorAll('.member-card');
    memberCards.forEach(card => {
        card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            return;
        }
        
        const login = card.dataset.login;
        const projectsDropdown = document.getElementById(`projects-${login}`);
        
        const allDropdowns = document.querySelectorAll('[id^="projects-"]');
        allDropdowns.forEach(dropdown => {
            if (dropdown.id !== `projects-${login}`) {
            dropdown.classList.add('hidden');
            }
        });
        
        if (projectsDropdown) {
            projectsDropdown.classList.toggle('hidden');
        }
        });
    });

  const toggleChecklistBtn = document.getElementById('toggleChecklist');
  const checklistContent = document.getElementById('checklistContent');
  
  if (toggleChecklistBtn && checklistContent) {
    toggleChecklistBtn.addEventListener('click', () => {
      checklistContent.classList.toggle('hidden');
      toggleChecklistBtn.textContent = checklistContent.classList.contains('hidden') 
        ? 'Show Module Checklist' 
        : 'Hide Module Checklist';
    });
  }
}
