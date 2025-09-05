// In your chart.ts file
import Chart from 'chart.js/auto';

// Track chart instances
let winLossChartInstance: Chart | null = null;

export function initWinLossChart(stats: any): void {
  const canvas = document.getElementById('win-loss-chart') as HTMLCanvasElement;
  if (!canvas) return;

  if (winLossChartInstance) {
    winLossChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  winLossChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses'],
      datasets: [{
        data: [stats.games_won || 0, stats.games_lost || 0],
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#D1D5DB'
          }
        }
      }
    }
  });
}
