// utils/charts.ts
import Chart from 'chart.js/auto';

export function initWinLossChart(stats: any): void {
  const canvas = document.getElementById('win-loss-chart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [{
        data: [stats.games_won || 0, stats.games_lost || 0, stats.games_drawn || 0],
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

export function initMonthlyPerformanceChart(monthlyData: any[]): void {
  const canvas = document.getElementById('monthly-chart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const months = monthlyData.map(item => item.month);
  const wins = monthlyData.map(item => item.wins);
  const losses = monthlyData.map(item => item.losses);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Wins',
          data: wins,
          backgroundColor: '#10B981'
        },
        {
          label: 'Losses',
          data: losses,
          backgroundColor: '#EF4444'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#D1D5DB' }
        },
        y: {
          stacked: true,
          ticks: { color: '#D1D5DB' }
        }
      }
    }
  });
}
