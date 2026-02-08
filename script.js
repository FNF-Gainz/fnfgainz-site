// ========== NEON PARTICLE BACKGROUND ==========
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const PARTICLE_COUNT = 60;

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(initial) {
    this.x = Math.random() * width;
    this.y = initial ? Math.random() * height : -10;
    this.size = Math.random() * 2 + 0.5;
    this.speedY = Math.random() * 0.4 + 0.1;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 0.02 + 0.005;
    // Occasional bright spark
    this.isSpark = Math.random() < 0.15;
    if (this.isSpark) {
      this.size = Math.random() * 1.5 + 1;
      this.opacity = Math.random() * 0.4 + 0.3;
    }
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.pulse += this.pulseSpeed;

    // Subtle drift
    this.x += Math.sin(this.pulse) * 0.15;

    if (this.y > height + 10 || this.x < -10 || this.x > width + 10) {
      this.reset(false);
    }
  }

  draw() {
    const pulseOpacity = this.opacity * (0.6 + Math.sin(this.pulse) * 0.4);

    if (this.isSpark) {
      // Neon glow spark
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 4
      );
      gradient.addColorStop(0, `rgba(96, 165, 250, ${pulseOpacity})`);
      gradient.addColorStop(0.3, `rgba(59, 130, 246, ${pulseOpacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 210, 255, ${pulseOpacity})`;
      ctx.fill();
    } else {
      // Regular particle
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(59, 130, 246, ${pulseOpacity})`;
      ctx.fill();
    }
  }
}

// Draw faint connection lines between nearby particles
function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        const opacity = (1 - dist / 120) * 0.06;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

// Initialize
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push(new Particle());
}

function animate() {
  ctx.clearRect(0, 0, width, height);

  drawConnections();

  for (const particle of particles) {
    particle.update();
    particle.draw();
  }

  requestAnimationFrame(animate);
}

animate();
