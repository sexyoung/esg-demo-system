import { PrismaClient, ProjectStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.project.deleteMany();

  await prisma.project.createMany({
    data: [
      {
        name: '供應鏈碳盤查',
        owner: 'Sustainability Team',
        status: ProjectStatus.ACTIVE,
        carbonTons: 1280,
      },
      {
        name: '再生能源導入',
        owner: 'Facilities',
        status: ProjectStatus.PLANNING,
        carbonTons: 420,
      },
      {
        name: '廢棄物減量追蹤',
        owner: 'Operations',
        status: ProjectStatus.ACTIVE,
        carbonTons: 190,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
