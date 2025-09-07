// particleSystem.ts
export interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  life: number;
  maxLife: number;
}


export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private mouseX: number = 0;
  private mouseY: number = 0;
  private animationId: number = 0;
  private width: number = 0;
  private height: number = 0;

  private backgroundImage: HTMLImageElement | null = null;

  constructor(canvasId: string = 'particle-canvas') {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.backgroundImage = new Image();
    this.backgroundImage.src = "background.jpg";

    this.backgroundImage.onload = () => {
      this.init();
      this.bindEvents();
      this.animate();
    };
  }

  private init(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  private bindEvents(): void {
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      
      if (Math.random() > 0.7) {
        this.createParticle(this.mouseX, this.mouseY);
      }
    });

    for (let i = 0; i < 100; i++) {
      this.createParticle(
        Math.random() * this.width,
        Math.random() * this.height
      );
    }
  }


  private updateParticles(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      const dx = this.mouseX - p.x;
      const dy = this.mouseY - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0 && distance < 150) {
        const force = 0.005;
        p.speedX += (dx / distance) * force;
        p.speedY += (dy / distance) * force;
      }
      
      p.x += p.speedX;
      p.y += p.speedY;
      
      p.speedX *= 0.98;
      p.speedY *= 0.98;
      
      if (p.x < 0 || p.x > this.width) p.speedX *= -0.8;
      if (p.y < 0 || p.y > this.height) p.speedY *= -0.8;
      
      p.x = Math.max(0, Math.min(this.width, p.x));
      p.y = Math.max(0, Math.min(this.height, p.y));
      
      p.life++;
      
      if (p.life > p.maxLife) {
        this.particles.splice(i, 1);
        i--;
      }
    }
    
    if (this.particles.length < 50 && Math.random() > 0.9) {
      this.createParticle(
        Math.random() * this.width,
        Math.random() * this.height
      );
    }
  }


   private createParticle(x: number, y: number): void {
    const colors = [
      'rgba(99, 102, 241, 0.7)',  // indigo
      'rgba(139, 92, 246, 0.7)',  // purple
      'rgba(16, 185, 129, 0.7)',  // green
      'rgba(245, 158, 11, 0.7)',  // ywllowish
      'rgba(236, 72, 153, 0.7)',  // pink
      'rgba(6, 182, 212, 0.7)'    // cyan
    ];
    
    const particle: Particle = {
      x,
      y,
      size: Math.random() * 3 + 2,
      speedX: Math.random() * 3 - 1.5,
      speedY: Math.random() * 3 - 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: Math.random() * 300 + 200
    };
    
    this.particles.push(particle);
  }

  
  private drawParticles(): void {
    if (this.backgroundImage) {
      this.ctx.save();
      this.ctx.filter = 'blur(20px)';
      this.ctx.drawImage(this.backgroundImage, 0, 0, this.width, this.height);
      this.ctx.restore();
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) {
          const opacity = 0.3 - distance / 400;
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }
    
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const size = p.size * (1 - lifeRatio * 0.5);
      
      this.ctx.globalAlpha = 0.8 - lifeRatio * 0.7;
      
      const gradient = this.ctx.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, size * 2
      );
      gradient.addColorStop(0, p.color.replace('0.7', '0.4'));
      gradient.addColorStop(1, 'transparent');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.globalAlpha = 1;
  }

  private animate = (): void => {
    this.updateParticles();
    this.drawParticles();
    this.animationId = requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', () => this.resize());
  }
}
