/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lesson, StudentUser, TeacherUser, StudentProgress, TeacherRemediationMaterial } from './types';
import { expandLessons, scaleProgressToQuizSize } from './quizgen';

export const MOCK_STUDENTS: StudentUser[] = [
  { lrn: "101234567891", name: "Sophia Cruz", gradeLevel: "Grade 4 - Section Newton" },
  { lrn: "101234567892", name: "Ethan Reyes", gradeLevel: "Grade 4 - Section Newton" },
  { lrn: "101234567893", name: "Chloe Santos", gradeLevel: "Grade 4 - Section Einstein" },
  { lrn: "101234567894", name: "Liam Garcia", gradeLevel: "Grade 5 - Section Newton" },
  { lrn: "101234567895", name: "Mia Fernandez", gradeLevel: "Grade 5 - Section Newton" },
  { lrn: "101234567896", name: "Noah Villanueva", gradeLevel: "Grade 5 - Section Einstein" },
  { lrn: "101234567897", name: "Ava Mendoza", gradeLevel: "Grade 6 - Section Newton" },
  { lrn: "101234567898", name: "Lucas Torres", gradeLevel: "Grade 6 - Section Newton" },
  { lrn: "101234567899", name: "Ella Ramos", gradeLevel: "Grade 6 - Section Einstein" },
  { lrn: "101234567900", name: "Jacob Flores", gradeLevel: "Grade 6 - Section Einstein" },
];

export const MOCK_TEACHERS: TeacherUser[] = [
  { teacherId: "T-2026-001", name: "Mrs. Elena Santos", department: "Science Dept." },
  { teacherId: "T-2026-002", name: "Mr. Ricardo Perez", department: "Science Dept." },
];

export const MOCK_LESSONS: Lesson[] = [
  {
    id: "L1",
    title: "Lesson 1: The Human Body Systems",
    description: "Learn how muscular, skeletal, digestive, respiratory, and circulatory systems work together to keep us growing and healthy.",
    topics: [
      {
        id: "L1-T1",
        name: "Skeletal System",
        description: "The hard framework of our bones that supports the body, allows movement, and protects soft internal organs.",
        readingTime: "5 mins",
        content: {
          introduction: "The skeletal system is made up of all the bones, cartilage, joints, and ligaments in your body. It acts as the central frame of your body, much like the wooden or steel beams inside a house.",
          sections: [
            {
              title: "What Bones Do (Core Functions)",
              body: "Your skeleton has five main jobs:\n1. Support: It holds you upright so you do not collapse like a wet noodle!\n2. Protection: Hard bones protect softer organs inside (like your brain and lungs).\n3. Movement: Muscles pull on bones to move your legs, arms, and mouth.\n4. Blood Cell Production: Inside the soft parts of some bones, your body creates new red and white blood cells.\n5. Storage: Bones store minerals like calcium to keep you healthy."
            },
            {
              title: "Chief Protective Bones",
              body: "• Skull: A strong, helmet-like bone structure that surrounds and protects your fragile brain.\n• Rib Cage: A curved cage of 12 pairs of ribs that guards your beating heart and lungs.\n• Spine (Vertebrae): A column of small bones stacked on top of each other. It holds up your head and protects your spinal cord."
            },
            {
              title: "Fun Bone Facts",
              body: "Did you know? An adult human has exactly 206 bones in their body! However, you were born with about 270 soft bones. As you grow, many of these small bones fuse together to form larger, stronger bones."
            }
          ],
          definition: {
            term: "Bone Marrow",
            meaning: "The soft tissue inside the center of larger bones where new blood cells are made daily."
          },
          importantNote: "Bones are alive! They are lightweight, grow as you grow, can heal themselves if broken, and require plenty of calcium (from milk, cheese, and green vegetables) to stay strong.",
          keyTakeaway: "Your skeletal system acts as a protective shield and structural framework for the body, housing 206 living bones."
        },
        quiz: [
          {
            id: "Q1-1",
            question: "How many bones are there in an adult human body?",
            options: [
              "106 bones",
              "206 bones",
              "306 bones",
              "270 bones"
            ],
            correctAnswerIndex: 1,
            explanation: "An adult human body has exactly 206 bones, while babies are born with more than 270 bones that fuse together over time."
          },
          {
            id: "Q1-2",
            question: "Which of the following bones acts as a helmet to protect the brain?",
            options: [
              "Rib cage",
              "Backbone",
              "Skull",
              "Hip bone"
            ],
            correctAnswerIndex: 2,
            explanation: "The skull is a round, hard bone structure that acts like a built-in safety helmet for your brain."
          },
          {
            id: "Q1-3",
            question: "Where in the skeletal system are blood cells produced?",
            options: [
              "Joints",
              "Bone Marrow",
              "Cartilage",
              "The surface of the skull"
            ],
            correctAnswerIndex: 1,
            explanation: "Bone marrow is the soft jelly-like material found inside larger bones that is responsible for producing blood cells."
          }
        ]
      },
      {
        id: "L1-T2",
        name: "Muscular System",
        description: "How voluntary and involuntary muscles contract and relax to allow movement throughout our body.",
        readingTime: "5 mins",
        content: {
          introduction: "The muscular system is made up of over 600 muscles that cover your skeleton. Muscles are made of stretchy fibers that contract (squeeze and shorten) and relax (stretch out) to move bones.",
          sections: [
            {
              title: "How Muscles Move Bones",
              body: "Muscles are connected to bones by tough strings called tendons. Muscles can only pull bones; they cannot push them. Because of this, skeletal muscles always work in pairs!\n• For example, to bend your elbow, your bicep muscle contracts (shortens) while your tricep muscle relaxes (lengthens).\n• To straighten your arm, they switch duties!"
            },
            {
              title: "Voluntary vs. Involuntary Muscles",
              body: "• Voluntary Muscles: Muscles you can control when you choose to. Examples include your bicep muscles when throwing a baseball, your hands writing notes, or your lips smiling.\n• Involuntary Muscles: Muscles that work automatically without you having to think about it. Examples include your heart beating constantly, your stomach contracting to squeeze food, or your chest breathing at night."
            },
            {
              title: "Three Types of Muscle Tissues",
              body: "1. Skeletal Muscle: Stretchy muscle attached to bones (voluntary).\n2. Smooth Muscle: Found in organs like your stomach and esophagus (involuntary).\n3. Cardiac Muscle: Dedicated exclusively to your heart. It never gets tired from pump cycles! (involuntary)."
            }
          ],
          definition: {
            term: "Tendon",
            meaning: "A tough, white cord or band of fibrous tissue that connects a muscle securely to a bone."
          },
          importantNote: "Skeletal muscles always work in opposing contraction pairs because a muscle can pull a bone but cannot push it back to its original position.",
          keyTakeaway: "Over 600 muscles of voluntary and involuntary types contract and work in pairs to enable motion."
        },
        quiz: [
          {
            id: "Q2-1",
            question: "Which of these is an example of an involuntary muscle?",
            options: [
              "Finger muscles holding a pencil",
              "Arm muscles waving hello",
              "Heart muscle pumping blood",
              "Leg muscles kicking a ball"
            ],
            correctAnswerIndex: 2,
            explanation: "The heart beats automatically without you thinking, making it a classic example of an involuntary muscle."
          },
          {
            id: "Q2-2",
            question: "Why do skeletal muscles work in pairs?",
            options: [
              "Because muscles can only pull, they cannot push",
              "Because legs and arms are mirrored on both sides",
              "To keep the bone from breaking in half",
              "To make blood cells twice as fast"
            ],
            correctAnswerIndex: 0,
            explanation: "Muscles can only pull and shorten. To move a joint back and forth, you need a pair of muscles pulling in opposite directions."
          },
          {
            id: "Q2-3",
            question: "What is the name of the white connector cords that tie muscles to bones?",
            options: [
              "Cartilage",
              "Blood vessels",
              "Tendons",
              "Vertebrae"
            ],
            correctAnswerIndex: 2,
            explanation: "Tendons are very tough bands of tissue that glue skeletal muscles to bones so that pulling moves the frame."
          }
        ]
      },
      {
        id: "L1-T3",
        name: "Digestive System",
        description: "Explore how your body crushes, dissolves, and absorbs energy from the food you eat.",
        readingTime: "6 mins",
        content: {
          introduction: "Your body needs energy to play and learn, but your organs cannot use a whole apple or a bowl of rice. The digestive system's job is to break delicious food down into invisible nutrients that your organs can absorb.",
          sections: [
            {
              title: "The Mouth and Esophagus",
              body: "1. Teeth: Chew and grind food mechanically into smaller pieces.\n2. Saliva (Spit): Wetting agent that contains enzymes to chemically begin breaking down starches.\n3. Esophagus: A long muscular pipe that squeezes food down from the mouth to the stomach in a wave-like muscle movement."
            },
            {
              title: "The Stomach and Small Intestine",
              body: "4. Stomach: A stretchy muscular organ that churns food like a blender. It mixes food with strong acids and enzymes to turn it into a thick soupy liquid.\n5. Small Intestine: A long, coiled tube where most of the digestion happens. Special tiny finger-like bumps called villi absorb nutrients directly from digested food into your blood stream."
            },
            {
              title: "Large Intestine and Waste",
              body: "6. Large Intestine: Any leftover material moves here. Water is absorbed back into the body, turning leftovers into solid waste.\n7. Waste Removal: Solid waste is pushed out of the body when we go to the bathroom."
            }
          ],
          definition: {
            term: "Absorption",
            meaning: "The process where nutrients are soaked up through the walls of the small intestine into the bloodstream."
          },
          importantNote: "Most digestion and nutrient absorption happens in the super-long small intestine, which is about 20 feet long inside your belly!",
          keyTakeaway: "Digestion transforms food into digestible blood nutrients through mechanical crushing and chemical acid breakdowns."
        },
        quiz: [
          {
            id: "Q3-1",
            question: "In which organ is most of the digested food nutrients absorbed into the blood?",
            options: [
              "The Mouth",
              "The Stomach",
              "The Small Intestine",
              "The Large Intestine"
            ],
            correctAnswerIndex: 2,
            explanation: "Most digestion and nutrient absorption occurs in the small intestine, which uses millions of tiny villi to soak up nutrients."
          },
          {
            id: "Q3-2",
            question: "What is the primary job of the teeth and saliva in the mouth?",
            options: [
              "To cool food down before swallowing",
              "To start mechanical and chemical breakdown",
              "To filter air entering our digestive tract",
              "To absorb water directly into the brain"
            ],
            correctAnswerIndex: 1,
            explanation: "Teeth grind food mechanically and saliva contains fluids and enzymes to start chemical digestion."
          },
          {
            id: "Q3-3",
            question: "What is the main task of the large intestine?",
            options: [
              "Absorb remaining water and form solid waste",
              "Absorb proteins and fats into the veins",
              "Grind solid foods using acids",
              "Pump carbon dioxide out of the body"
            ],
            correctAnswerIndex: 0,
            explanation: "The large intestine soaks up most of the leftover water from undigested food and packages the remaining waste to be removed."
          }
        ]
      },
      {
        id: "L1-T4",
        name: "Respiratory System",
        description: "Breathing mechanics, oxygen absorption in lungs, and removing waste carbon dioxide.",
        readingTime: "5 mins",
        content: {
          introduction: "Every cell in your body needs gas called oxygen to release energy. The respiratory system allows your body to breathe in oxygen from air and breathe out carbon dioxide waste.",
          sections: [
            {
              title: "The Air Path: Nose to Windpipe",
              body: "• Nose and Mouth: Air entering is warmed up, wetted, and hairs inside filter out dust particles.\n• Windpipe (Trachea): A stiff tube of circular cartilage rings that guides filtered air down into your chest cavity.\n• Bronchi: The windpipe splits into two branch-like tubes that go directly into each lung."
            },
            {
              title: "Inside the Lungs (The Trapped Air Bags)",
              body: "Inside your lungs, bronchi branch out into tinier tubes, like limbs on a tree. At the very ends of these branches are tiny air sacs called Alveoli. Alveoli look like folders of mini-grapes. They have very thin walls and are covered in blood vessels. Here, oxygen skips from air into your blood, and carbon dioxide skips from your blood into air."
            },
            {
              title: "The Diaphragm Muscle",
              body: "How do you pull air in? A large dome-shaped muscle beneath your lungs called the Diaphragm pulls down when you inhale (creating space in your chest) and pushes up when you exhale to squeeze stale air out!"
            }
          ],
          definition: {
            term: "Alveoli",
            meaning: "Microscopic air sacs at the ends of lung bronchi tubes where oxygen is swapped for carbon dioxide."
          },
          importantNote: "The diaphragm muscle must contract and pull down to create suction that fills your lungs with fresh air.",
          keyTakeaway: "The respiratory system absorbs oxygen and vents waste carbon dioxide via gas exchanges inside lung alveoli."
        },
        quiz: [
          {
            id: "Q4-1",
            question: "What are Alveoli?",
            options: [
              "Cartilage rings that stiffen the windpipe",
              "Filter hairs that block nose dust",
              "Tiny air sacs in the lungs where gas exchange happens",
              "Small bones that form the rib cage"
            ],
            correctAnswerIndex: 2,
            explanation: "Alveoli are grape-like microscopic air sacs at the tips of bronchi branches where gas exchanges with capillaries."
          },
          {
            id: "Q4-2",
            question: "Which dome-shaped muscle is responsible for pulling down to inflate lungs with air?",
            options: [
              "Cardiac muscle",
              "Smooth stomach muscle",
              "Diaphragm",
              "Trachea"
            ],
            correctAnswerIndex: 2,
            explanation: "The diaphragm contracts and flattens down, expanding space in your chest to draw fresh air into the lungs."
          }
        ]
      },
      {
        id: "L1-T5",
        name: "Circulatory System",
        description: "The heart engine, blood pipelines, and transport of materials to bodily tissues.",
        readingTime: "6 mins",
        content: {
          introduction: "The circulatory system is the delivery network of your body. Its job is to pump blood carrying oxygen, water, and nutrients to every cell in your body, and carry wastes away for cleanup.",
          sections: [
            {
              title: "The Heart: A Powerful Involuntary Engine",
              body: "Your heart is a hollow involuntary muscle about the size of your fist. It acts as a pump that beats over 100,000 times a day without rest! The heart has four chambers: two at the top (atria) and two at the bottom (ventricles)."
            },
            {
              title: "The Three Types of Vessels (The Blood Pipelines)",
              body: "1. Arteries: Thick, strong pipes that carry clean, oxygen-rich blood *away* from the heart to all parts of your body. (A for Away!)\n2. Veins: Blue-colored pipelines that carry blood containing waste gases *back* to the heart.\n3. Capillaries: Super-thin network webs where oxygen and nutrients escape directly to cells, and wastes enter."
            },
            {
              title: "What makes up blood?",
              body: "• Red Blood Cells: Delivery vehicles carrying oxygen.\n• White Blood Cells: Soldier cells fighting viruses and bacteria.\n• Platelets: Solid cells that clot blood to heal cuts.\n• Plasma: The liquid part of blood that carries nutrients."
            }
          ],
          definition: {
            term: "Capillary",
            meaning: "A tiny microscopic blood vessel that connects arteries and veins, allowing materials to slip through its walls to feed cells."
          },
          importantNote: "Arteries carry oxygen-rich blood away from the heart, while veins transport oxygen-poor blood back to the heart.",
          keyTakeaway: "The heart pumps oxygenated, nutrient-dense blood through arteries and retrieves wastes in veins."
        },
        quiz: [
          {
            id: "Q5-1",
            question: "Which blood vessels have the primary job of carrying blood AWAY from your heart?",
            options: [
              "Veins",
              "Capillaries",
              "Arteries",
              "Cartilage lines"
            ],
            correctAnswerIndex: 2,
            explanation: "Arteries carry blood away from the heart (remember 'A' inside Arteries stands for Away)."
          },
          {
            id: "Q5-2",
            question: "Which cells in your blood act like a defense force to fight infections?",
            options: [
              "Red blood cells",
              "White blood cells",
              "Platelets",
              "Plasma droplets"
            ],
            correctAnswerIndex: 1,
            explanation: "White blood cells act as your body's immune defense, chasing and destroying germs and viruses."
          }
        ]
      }
    ]
  },
  {
    id: "L2",
    title: "Lesson 2: Matter and Its Properties",
    description: "Explore solids, liquids, and gases, physical characteristics, and the physical or chemical changes that substances undergo.",
    topics: [
      {
        id: "L2-T1",
        name: "States of Matter",
        description: "Examine solids, liquids, and gases by how their tiny molecules behave under heating and cooling.",
        readingTime: "5 mins",
        content: {
          introduction: "Matter is anything that has mass (weight) and takes up space. All matter on Earth is made of tiny particles called molecules. These molecules behave differently, giving us three main states: Solid, Liquid, and Gas.",
          sections: [
            {
              title: "Solids: Definite Shape & Volume",
              body: "In a solid, molecules are packed incredibly tightly together in a neat arrangement. They cannot move around; they can only vibrate in place. This is why a solid (like a wooden block, pencil, or car) keeps its shape and does not flow."
            },
            {
              title: "Liquids: Flowing Fluids with Definite Volume",
              body: "In a liquid, molecules are loose and can slide past each other. This is why liquids can flow and change shape depending on what container you pour them into (like water filling a cup or a bowl). However, they keep the same volume (size)."
            },
            {
              title: "Gases: No Definite Shape or Volume",
              body: "In a gas, molecules are super active, far apart, and fly in all directions! A gas will spread out to fill any container it is in, no matter how big or small. Air is a collection of invisible gases."
            }
          ],
          definition: {
            term: "Matter",
            meaning: "Anything that has weight (mass) and takes up physical space."
          },
          keyTakeaway: "Particles are packed locked in solids, slide in liquids, and fly freely in gases."
        },
        quiz: [
          {
            id: "Q6-1",
            question: "In which state of matter are the tiny molecules packed very tightly and cannot move around?",
            options: [
              "Gas",
              "Liquid",
              "Solid",
              "Plasma"
            ],
            correctAnswerIndex: 2,
            explanation: "In a solid, molecules are tightly bound in place, allowing only slight vibrations so changes in shape do not occur easily."
          },
          {
            id: "Q6-2",
            question: "What happens to the shape of a liquid when poured into a jar?",
            options: [
              "It keeps its original block shape",
              "It changes its shape to match the jar",
              "It expands to float out of the jar completely",
              "It turns into a solid automatically"
            ],
            correctAnswerIndex: 1,
            explanation: "Liquids do not have a fixed shape. Their molecules slide past each other, taking the exact shape of whatever container holds them."
          }
        ]
      },
      {
        id: "L2-T2",
        name: "Physical Properties",
        description: "How to observe, measure, and identify substances using mass, shape, density, and magnetic traits.",
        readingTime: "5 mins",
        content: {
          introduction: "We can describe, sort, and identify different objects by observing their physical properties. Physical properties are traits we can see, smell, feel, or measure without changing what the object is.",
          sections: [
            {
              title: "Mass and Volume",
              body: "• Mass: The amount of material in an object. We measure mass with scales using grams or kilograms.\n• Volume: The amount of space an object takes up. We measure liquid volume using graduated cylinders."
            },
            {
              title: "Floating and Sinking (Density Intro)",
              body: "Why does a massive tree trunk float on a lake while a small steel nail sinks directly to the rock bed? This refers to Density!\nDensity is how tightly packed an object's molecules are. If an object is less dense than water, it floats. If it is denser than water, it sinks."
            },
            {
              title: "Special Physical Traits",
              body: "• Hardness: How easily a solid can be scratched (diamonds are the hardest!).\n• Magnetism: If an object is attracted to a magnet (like iron or steel metals).\n• Solubility: How easily a substance dissolves in water (like salt and sugar)."
            }
          ],
          definition: {
            term: "Density",
            meaning: "A measurement of how tightly packed together the molecules inside a substance are."
          },
          importantNote: "Ice floats on water because its crystalline structure makes it less dense than bulk liquid water molecules.",
          keyTakeaway: "Mass, volume, color, hardness, and magnetic traits let us describe and group matter."
        },
        quiz: [
          {
            id: "Q7-1",
            question: "Why does a small metal paperclip sink in a cup of water?",
            options: [
              "It is too heavy",
              "It is denser than water",
              "It dissolves in water",
              "It is magnetic"
            ],
            correctAnswerIndex: 1,
            explanation: "Whether something sinks or floats depends on density. Metal has packed molecules making it denser than water, causing it to sink."
          },
          {
            id: "Q7-2",
            question: "Which property describes how easily sugar dissolve in warm water?",
            options: [
              "Magnetism",
              "Hardness",
              "Solubility",
              "Density"
            ],
            correctAnswerIndex: 2,
            explanation: "Solubility is the speed and ability of a substance (like sugar) to dissolve into a liquid solvent."
          }
        ]
      },
      {
        id: "L2-T3",
        name: "Changes in Matter",
        description: "Physical changes versus chemical changes in substances.",
        readingTime: "5 mins",
        content: {
          introduction: "Matter undergoes various changes. These changes can be sorted into two categories: Physical Changes and Chemical Changes.",
          sections: [
            {
              title: "Physical Changes: No New Substances Made",
              body: "In a physical change, only the size, shape, or state of matter changes, but the material itself remains the same.\n• Examples: Tearing a sheet of paper (it is still paper!), melting ice into liquid water (still H2O), or freezing juice into popsicles. Many physical changes are *reversible* (meaning they can be undone)."
            },
            {
              title: "Chemical Changes: Brand New Materials Created",
              body: "In a chemical change, substances react and transform into brand new materials with entirely different properties. Chemical changes are usually *irreversible* (cannot be undone).\n• Examples: Burning wood (turns into ash and smoke), baking a cake batter, or a shiny bicycle chain rusting in rain."
            },
            {
              title: "Clues of a Chemical Change",
              body: "How can you tell if a chemical change happened? Look for these signs:\n1. A color change happens suddenly.\n2. Bubbles of gas are released.\n3. Heat, light, or sparks are produced.\n4. A new smell is noticed."
            }
          ],
          definition: {
            term: "Reversible Change",
            meaning: "A physical change that can be undone to return the object to its original state (like freezing water and then melting it)."
          },
          keyTakeaway: "Physical changes alter appearance but keep ingredients; chemical changes create completely new materials."
        },
        quiz: [
          {
            id: "Q8-1",
            question: "Which of the following is an example of a chemical change?",
            options: [
              "Slicing an apple in half",
              "Melting an ice cube",
              "Crushing an aluminum can",
              "Rusty nails forming in damp dirt"
            ],
            correctAnswerIndex: 3,
            explanation: "Rusting is a chemical reaction between iron metal, water, and oxygen that creates a new orange powdery compound."
          },
          {
            id: "Q8-2",
            question: "Why is tearing a piece of paper considered a physical change?",
            options: [
              "Because we cannot turn it back into wood logs",
              "Because it changes color",
              "Because it is still paper, and no new substance was made",
              "Because it produces heat and sparks"
            ],
            correctAnswerIndex: 2,
            explanation: "Tearing only changes the size and shape of the paper. It does not alter the actual ingredient molecules, keeping it a physical change."
          }
        ]
      },
      {
        id: "L2-T4",
        name: "Mixtures and Solutions",
        description: "Inspect combination mixtures where substances stay separate, versus dissolving into homogeneous solutions.",
        readingTime: "6 mins",
        content: {
          introduction: "In science, substances can be combined. When we mix things together, they can behave in two ways, forming either a Mixture or a Solution.",
          sections: [
            {
              title: "What is a Mixture?",
              body: "A mixture is a combination of two or more materials that are mixed together but do not combine chemically. Each substance keeps its original physical properties, and they can be separated easily!\n• Examples: A bowl of salad (you can pick out tomatoes), sand mixed with water, or a jar of mixed nuts."
            },
            {
              title: "What is a Solution?",
              body: "A solution is a special type of mixture where one substance dissolves completely and spreads evenly inside another substance. In solutions, one substance invisible dissolves so you cannot see the separated pieces.\n• Examples: Dissolving salt into water, or sweet lemonade juice."
            },
            {
              title: "Solute vs. Solvent",
              body: "• Solute: The substance that *dissolves* (example: the salt powder).\n• Solvent: The substance that *does the dissolving* (example: water liquid)."
            }
          ],
          definition: {
            term: "Solution",
            meaning: "A uniform mixture where a solute dissolves completely inside a liquid solvent."
          },
          keyTakeaway: "Mixtures have separate parts you can pick apart; solutions are dissolved and look uniform."
        },
        quiz: [
          {
            id: "Q9-1",
            question: "When you stir salt completely into warm water, what special type of mixture do you create?",
            options: [
              "A chemical block",
              "An insoluble gas",
              "A solution",
              "A physical solid"
            ],
            correctAnswerIndex: 2,
            explanation: "Stirring salt into water dissolves the salt molecules completely and evenly, producing a uniform solution."
          },
          {
            id: "Q9-2",
            question: "In sugar water, what name matches the sugar because it is the substance being dissolved?",
            options: [
              "Solvent",
              "Solute",
              "Filter",
              "Vapor"
            ],
            correctAnswerIndex: 1,
            explanation: "The solute is the substance that gets dissolved (like sugar), while the solvent is the liquid that dissolves it (like water)."
          }
        ]
      }
    ]
  },
  {
    id: "L3",
    title: "Lesson 3: Force, Motion, and Energy",
    description: "Discover types of forces, how motion is measured, and explore different forms of thermal and light energy.",
    topics: [
      {
        id: "L3-T1",
        name: "Types of Forces",
        description: "Pushes and pulls: GRAVITY pulling falling objects, and FRICTION resisting movement.",
        readingTime: "5 mins",
        content: {
          introduction: "A force is simply a raise: any push or pull on an object. Forces can make things start moving, stop moving, speed up, slow down, or change direction.",
          sections: [
            {
              title: "Gravity: The Universal Puller",
              body: "Gravity is an invisible non-contact force that pulls all objects toward each other. Earth has massive gravity because it has huge bulk mass. Gravity is what keeps your feet on the ground and pulls falling balls down to the floor."
            },
            {
              title: "Friction: The Braking Force",
              body: "Friction is a contact force that acts in the opposite direction of moving objects, slowing them down! When two surfaces slide past each other, bumps on the rough surfaces block rubbing wheels.\n• Smooth ice has very low friction (easy to slide).\n• Rough dirt or grass has high friction (hard to push boxes)."
            },
            {
              title: "Magnetic Force",
              body: "An invisible attraction or push force from magnetic fields. Opposite poles pull together (N-S), and identical poles push away (N-N, S-S)."
            }
          ],
          definition: {
            term: "Friction",
            meaning: "A force that resists sliding movement between two touching surfaces, producing heat and slowing objects down."
          },
          keyTakeaway: "Pushes and pulls include gravity pulling down, and friction resisting and slowing sliding objects."
        },
        quiz: [
          {
            id: "Q10-1",
            question: "Which force is responsible for pulling a tossed baseball back down to the grass field?",
            options: [
              "Friction",
              "Magnetism",
              "Gravity",
              "Elastic Force"
            ],
            correctAnswerIndex: 2,
            explanation: "Gravity is Earth's natural pull force that drags all physical materials back toward its center."
          }
        ]
      },
      {
        id: "L3-T2",
        name: "Motion",
        description: "Understanding speed, distance, and changes in position over time.",
        readingTime: "5 mins",
        content: {
          introduction: "Motion is a change in an object's position over time with respect to a reference point. When your dog runs from the porch to the gate, they are in motion.",
          sections: [
            {
              title: "How to Measure Speed",
              body: "Speed is how fast an object covers physical distance. We calculate speed using a classic mathematical relationship:\nSpeed = Distance / Time\n• If a cyclist travels 10 meters in 2 seconds, their speed is 10 / 2 = 5 meters per second (m/s)."
            },
            {
              title: "Reference Points",
              body: "To know if something is moving, we need a stationary reference point (like a tree, a building, or a lamp post). If your position relative to that landmark changes, you are in motion."
            }
          ],
          definition: {
            term: "Velocity",
            meaning: "The speed of an object in a specific, chosen direction (like running 5 m/s North)."
          },
          keyTakeaway: "Motion is tracked from stationary references, calculating speed by dividing distance covered by time spent."
        },
        quiz: [
          {
            id: "Q11-1",
            question: "How do you calculate the speed of a moving object?",
            options: [
              "Speed = Mass x Gravity",
              "Speed = Distance / Time",
              "Speed = Time - Weight",
              "Speed = Force x Friction"
            ],
            correctAnswerIndex: 1,
            explanation: "Speed calculates how much distance is covered in a certain amount of time, giving speed = distance divided by time."
          }
        ]
      },
      {
        id: "L3-T3",
        name: "Forms of Energy",
        description: "Analyze kinetic energy of speed, potential energy of altitude positions, plus chemical or sound energy formats.",
        readingTime: "5 mins",
        content: {
          introduction: "In science, Energy is defined as the ability to do work or make changes happen. Energy cannot be created or destroyed; it can only morph from one form format into another.",
          sections: [
            {
              title: "Kinetic vs. Potential Energy",
              body: "• Kinetic Energy (Energy of Motion): Anything moving carries kinetic energy. Examples: a spinning wind turbine, a running boy, or falling rain droplets.\n• Potential Energy (Stored Energy): Energy waiting to be released. Example: a heavy ball sitting at the top of a waterslide, or food storing chemical energy."
            }
          ],
          definition: {
            term: "Potential Energy",
            meaning: "Stored energy inside an object due to its high position, chemical composition, or stretched physical state."
          },
          keyTakeaway: "Potential energy represents height or chemical storage; kinetic energy represents speed of motion."
        },
        quiz: [
          {
            id: "Q12-1",
            question: "What form of energy is stored inside a heavy rock resting on top of a mountain cliff?",
            options: [
              "Kinetic Energy",
              "Potential Energy",
              "Light Energy",
              "Sound Energy"
            ],
            correctAnswerIndex: 1,
            explanation: "Objects at rest up high store gravitational potential energy, which converts to kinetic speed if they fall."
          }
        ]
      },
      {
        id: "L3-T4",
        name: "Heat Energy",
        description: "Study thermal transfers through solid conduction, liquid convection, and atmospheric radiation.",
        readingTime: "6 mins",
        content: {
          introduction: "Heat (thermal energy) is the energy caused by the vibrations of atoms inside matter. When things heat up, their molecules shake faster! Heat always moves from hot objects to cooler structures.",
          sections: [
            {
              title: "Three Ways Heat Travels",
              body: "1. Conduction (Direct Contact): Heat moves through direct contact. Example: a metal spoon heating up inside a hot bowl of soup.\n2. Convective Flow (Fluids): Heat moves through rising fluids. Hot, light liquid or air rises, while cold dense liquid sinks, forming loops. Example: boiling rice inside water.\n3. Radiation (Emanating Waves): Heat traveling across empty space in thermal waves. Example: Sunrays traveling through empty space to warm Earth."
            }
          ],
          definition: {
            term: "Radiation",
            meaning: "Heat transfer traveling through empty space across electromagnetic waves, without needing physical atoms to touch."
          },
          keyTakeaway: "Heat moves from hot to cold via touching conduction, fluid convection loops, or radiation waves."
        },
        quiz: [
          {
            id: "Q13-1",
            question: "Which type of heat transfer occurs when a metal spoon left inside a cup of hot soup turns hot to touch?",
            options: [
              "Conduction",
              "Convection",
              "Radiation",
              "Solar combustion"
            ],
            correctAnswerIndex: 0,
            explanation: "Conduction is the transfer of heat between substances that are in direct contact with each other."
          }
        ]
      },
      {
        id: "L3-T5",
        name: "Light Energy",
        description: "Explore straight-line light paths, bounce reflections, and bent refraction angles inside lenses.",
        readingTime: "5 mins",
        content: {
          introduction: "Light is a form of energy that we can see with our eyes. Light is incredibly fast and always travels in perfectly straight lines, called light waves.",
          sections: [
            {
              title: "Reflection: Bouncing Light",
              body: "When light waves hit a super smooth, shiny surface (like a looking glass mirror), they bounce off at the exact same angle they hit it. This bouncing of light is called Reflection, letting us see our reflection."
            },
            {
              title: "Refraction: Bent Light",
              body: "When light passes from one substance to another (like air into water), it changes speed and bends its path! This bending of light is called Refraction.\n• Refraction is why straw looks bent inside a cup of water, or why magnifying lenses work."
            }
          ],
          definition: {
            term: "Refraction",
            meaning: "The bending of light waves as they pass from one medium into another of different density (like air to water)."
          },
          keyTakeaway: "Light travels in straight lines, bouncing off mirrors as reflection, and bending in fluids as refraction."
        },
        quiz: [
          {
            id: "Q14-1",
            question: "Why does a straight drinking straw look cracked or bent when placed in a cup of water?",
            options: [
              "Because water melts plastic",
              "Because of Refraction (bended light paths)",
              "Because of Reflection (light bouncing)",
              "Because water blocks gravity waves"
            ],
            correctAnswerIndex: 1,
            explanation: "Refraction occurs because light slows down and bends as it travels from air into denser water fluid, distorting the geometric visual shape."
          }
        ]
      }
    ]
  },
  {
    id: "L4",
    title: "Lesson 4: Earth and Space",
    description: "Explore the layers of the Earth, climate versus daily weather changes, our solar system, and lunar moon cycles.",
    topics: [
      {
        id: "L4-T1",
        name: "Layers of the Earth",
        description: "Peeling back the planetary layers: solid crust, hot mantle, liquid outer core, and iron inner core.",
        readingTime: "5 mins",
        content: {
          introduction: "Our home planet Earth is not just one solid rock ball. It is structured like a giant peach, consisting of four layered spheres that change in thickness and heat as you dig deeper.",
          sections: [
            {
              title: "Peeling the Onion: The Four Spheres",
              body: "1. Crust: The thin, outermost rocky layer we live on. It is cold, dry, and holds all our mountains, forests, and oceans.\n2. Mantle: The thickest layer of Earth. It is made of hot, semi-melted rock and slowly moves like thick paste.\n3. Outer Core: A super-hot, liquid metal layer of liquid iron and nickel. Its currents create Earth's magnetic shield!\n4. Inner Core: The absolute center. Although it is as hot as the sun, it is squeezed into a perfectly solid heavy metal ball by crushing gravity forces!"
            }
          ],
          definition: {
            term: "Crust",
            meaning: "The thin, cold, outermost layer of Earth's solid rock framing mountains and oceanic floors."
          },
          keyTakeaway: "Earth has 4 layers: solid outer crust, sluggish hot mantle, liquid outer core, and solid inner core."
        },
        quiz: [
          {
            id: "Q15-1",
            question: "Which of Earth's layers is the thin outermost rock layer that humans live and build on?",
            options: [
              "Mantle",
              "Outer Core",
              "Crust",
              "Inner Core"
            ],
            correctAnswerIndex: 2,
            explanation: "The Crust is the thin rocky skin of Earth. Soil and oceans sit on top of this layer."
          }
        ]
      },
      {
        id: "L4-T2",
        name: "Weather and Climate",
        description: "The difference between temporary daily weather patterns and long-term climate regions.",
        readingTime: "5 mins",
        content: {
          introduction: "Many students confuse weather and climate. Though they are connected, they track totally different timeframes: weather is what is happening today, whereas climate is typical over decades.",
          sections: [
            {
              title: "Weather: Daily Changes",
              body: "Weather is the day-to-day state of the atmosphere in a local town. It can swing within hours!\n• Examples: It is rainy this morning, hot and sunny this afternoon, or cloudy tomorrow."
            },
            {
              title: "Climate: Decades of Patterns",
              body: "Climate is the average weather pattern in a region recorded over 30 or more years. It describes the typical environment of an entire country.\n• Examples: The Philippines has a tropical rainforest climate, whereas North Africa is extremely dry and hot."
            }
          ],
          definition: {
            term: "Climate",
            meaning: "The average weather conditions (temperature, rain, winds) in a large region over 30 years or more."
          },
          keyTakeaway: "Weather tracks daily rain and sun in a town; climate is the long-term averages over decades."
        },
        quiz: [
          {
            id: "Q16-1",
            question: "If a textbook says 'The Philippines commonly experiences dry, tropical rainforest seasons over long decades', what is it describing?",
            options: [
              "Daily Weather",
              "Seasonal Climate",
              "Atmospheric humidity checks",
              "Weekly forecasting lists"
            ],
            correctAnswerIndex: 1,
            explanation: "Long-term regional weather profiles observed over decades denote the climate of an area."
          }
        ]
      },
      {
        id: "L4-T3",
        name: "Solar System",
        description: "Our parent star Sun, and the eight planets revolving in orbits around it.",
        readingTime: "6 mins",
        content: {
          introduction: "The Solar System is our cosmic neighborhood. It has a massive bright star at its center (the Sun) circled by eight unique planets, dozens of moons, and millions of asteroids.",
          sections: [
            {
              title: "The Inner Rocky Planets",
              body: "These four planets are closest to the Sun, rocky, and relatively small:\n1. Mercury: Super hot, tiny planet.\n2. Venus: Heavy poisonous atmosphere.\n3. Earth: Our rich liquid-water home.\n4. Mars: The dusty red rust planet."
            },
            {
              title: "The Outer Gas Giants",
              body: "These four planets are far, massive, and made of ice and thick gases:\n5. Jupiter: The massive storm planet.\n6. Saturn: Celebrated shiny ring system.\n7. Uranus: A tilted frozen ice ball.\n8. Neptune: The windy dark blue planet."
            }
          ],
          definition: {
            term: "Orbit",
            meaning: "A curved path that a planet follows to revolve around a massive star like the Sun due to gravity."
          },
          keyTakeaway: "The solar system orbits 8 planets around 1 sun: four close rocky planets and four distant gas giants."
        },
        quiz: [
          {
            id: "Q17-1",
            question: "Which planet is most famous for its giant, beautiful rings made of spinning dust and ice blocks?",
            options: [
              "Mars",
              "Jupiter",
              "Saturn",
              "Neptune"
            ],
            correctAnswerIndex: 2,
            explanation: "Saturn is a gas giant planet that features massive, highly visible rings made of rock, dust, and ice chunks."
          }
        ]
      },
      {
        id: "L4-T4",
        name: "Phases of the Moon",
        description: "Lunar light reflection, revolution orbits, and cycles from New Moon to Waxing and Full Moon.",
        readingTime: "5 mins",
        content: {
          introduction: "The Moon does not produce any light of its own. It acts like a giant space dust mirror, reflecting bright sunlight down to our night eyes. As the Moon circles Earth over 29.5 days, we see varying amounts of its lit side.",
          sections: [
            {
              title: "The Lunar Cycle Progression",
              body: "1. New Moon: The Moon is between Earth and Sun. The lit side faces away, so the Moon looks dark or invisible!\n2. Waxing (Growing): Night by night, a sliver of white appears (Crescent) and grows into Half Moon (Quarter).\n3. Full Moon: Earth sits between Sun and Moon. The entire lit side is visible as a beautiful round glowing circle!\n4. Waning (Shrinking): The lit sliver shrinks down over the next two weeks until it turns dark again."
            }
          ],
          definition: {
            term: "Waxing",
            meaning: "The phases where the visible glowing portion of the Moon is growing larger night after night."
          },
          keyTakeaway: "Moon phases morph as its lit side faces us during its monthly orbit around Earth."
        },
        quiz: [
          {
            id: "Q18-1",
            question: "During which Moon phase is the Moon fully lit and looks like a bright round plate in the night sky?",
            options: [
              "New Moon",
              "Crescent Moon",
              "Full Moon",
              "Hollow Moon"
            ],
            correctAnswerIndex: 2,
            explanation: "A Full Moon happens when we see the entire sunlit half of the moon facing directly toward Earth."
          }
        ]
      }
    ]
  },
  {
    id: "L5",
    title: "Lesson 5: Living Things and Ecosystems",
    description: "Discover classification classifications, energy loops, food chains, biomes, and planetary conservation.",
    topics: [
      {
        id: "L5-T1",
        name: "Plants and Animals",
        description: "Investigate basic cell classifications, differences between vascular plants, and simple species categorization.",
        readingTime: "5 mins",
        content: {
          introduction: "Living organisms are sorted into groups by what they share. Plants and animals are complex, but they get energy and build cells in opposite ways.",
          sections: [
            {
              title: "Producers: Plants making Food",
              body: "Plants are producers because they make their own energy fuel! They use a green pigment called Chlorophyll to trap sunlight and turn water and air into sugar sugars. This special cell-making process is called Photosynthesis."
            },
            {
              title: "Consumers: Animals seeking Food",
              body: "Animals cannot make their own food. They must eat other plants or animals to survive, sorting them as consumers."
            }
          ],
          definition: {
            term: "Photosynthesis",
            meaning: "The process where green plants turn water, sunlight, and carbon dioxide into sugars and release clean oxygen."
          },
          keyTakeaway: "Plants act as producers making foods with sunlight; animals are consumers needing feeding."
        },
        quiz: [
          {
            id: "Q19-1",
            question: "What green chemical dye in plant leaves catches sunlight to power sugar food assembly?",
            options: [
              "Vertebrae",
              "Villi fluid",
              "Chlorophyll",
              "Plasma drops"
            ],
            correctAnswerIndex: 2,
            explanation: "Chlorophyll is the green pigment in plant cells that acts like solar panels catching light energy."
          }
        ]
      },
      {
        id: "L5-T2",
        name: "Food Chains",
        description: "How sun energy flows through feeding relationships: producers, primary consumers, secondary consumers, and decomposers.",
        readingTime: "5 mins",
        content: {
          introduction: "Every living thing needs energy. A food chain is a simple diagrams drawing that charts how energy moves as one living thing eats another in a wildlife community.",
          sections: [
            {
              title: "The Four Linkages of a Chain",
              body: "1. The Sun: The original, giant power source of all energy.\n2. Producers: Green plants that trap sun energy (like green garden grass).\n3. Consumers (Herbivores & Carnivores): Animals that eat lines. Grasshopper eats grass (Primary). Frog eats grasshopper (Secondary). Cobra eats frog (Tertiary).\n4. Decomposers: Tiny beetles, mushrooms, and bacteria that recycle dead leaves and bones back into nutrient-rich soil."
            }
          ],
          definition: {
            term: "Decomposer",
            meaning: "Organisms like fungi and bacteria that rot down dead plants and animals, returning mineral nutrients back to the soil."
          },
          keyTakeaway: "Energy loops sun to producer, to feeding consumers, and returns to soil via decomposers."
        },
        quiz: [
          {
            id: "Q20-1",
            question: "In a forest community, which of these organisms plays the helper role of a decomposer?",
            options: [
              "Green Oak tree",
              "Mushroom fungi",
              "Sly Fox predator",
              "Worm tracking frog"
            ],
            correctAnswerIndex: 1,
            explanation: "Mushrooms (fungi) are decomposers. They decay waste organic remains to feed soil ecosystems."
          }
        ]
      },
      {
        id: "L5-T3",
        name: "Habitats",
        description: "Different landscapes where species are adapted to thrive, such as oceans, rainforests, and sandy dry deserts.",
        readingTime: "5 mins",
        content: {
          introduction: "A habitat is the natural home or environment of an animal, plant, or other organism. It provides the animal with food, water, air, shelter, and a safe place to raise babies.",
          sections: [
            {
              title: "Major Habitats on Earth",
              body: "• Desert: Cruelly dry and sandy. Adapted cactus plants store water in fat trunks.\n• Tropical Rainforest: Hot, wet, crowded trees home to millions of monkeys and colorful birds.\n• Tundra: Sluggish, freezing wind zones. Animals grow thick fat fur coat layers."
            }
          ],
          definition: {
            term: "Habitat",
            meaning: "The localized natural home or environment of a plant or animal that satisfies all its life support needs."
          },
          keyTakeaway: "Every region (like wet forests, dry deserts, or oceans) has unique traits suited to its habitant species."
        },
        quiz: [
          {
            id: "Q21-1",
            question: "Why can a cactus plant survive in a hot, dry desert habitat?",
            options: [
              "Because it grows thick fur layers",
              "Because it has a fleshy thick stem designed to store stored water",
              "Because it feeds on small insects",
              "Because it has large leaves that float"
            ],
            correctAnswerIndex: 1,
            explanation: "Desert plants like cacti are adapted with thick, waxy, fleshy stems that hold water for long periods when rain is absent."
          }
        ]
      },
      {
        id: "L5-T4",
        name: "Ecosystems",
        description: "The delicate balance between living communities of organisms and non-living elements like soil and water.",
        readingTime: "5 mins",
        content: {
          introduction: "An ecosystem is a larger web. It is a community where living things interact with other living things, and also with non-living elements around them like sunlight, temperature, soil, and freshwater.",
          sections: [
            {
              title: "Biotic and Abiotic Assets",
              body: "• Biotic Factors (LIVING): All the animals, plants, insects, mushrooms, and bacteria in the forest.\n• Abiotic Factors (NON-LIVING): The soil quality, rain humidity, daily warmth lines, cool rivers, and bright sunlight."
            }
          ],
          definition: {
            term: "Abiotic",
            meaning: "The non-living physical and chemical parts of an environment (like air temperature, rocks, or soil)."
          },
          keyTakeaway: "An ecosystem matches the biotic living parts directly with abiotic non-living surroundings in a delicate state of balance."
        },
        quiz: [
          {
            id: "Q22-1",
            question: "Which of the following describes an abiotic (non-living) factor in a lake ecosystem?",
            options: [
              "Swimming Catfish",
              "Cool Lake Water",
              "Wiggle water lily plants",
              "Decaying mud bacteria"
            ],
            correctAnswerIndex: 1,
            explanation: "Water is abiotic because it is not alive, even though it is extremely necessary to sustain the living fish and plants in the lake."
          }
        ]
      },
      {
        id: "L5-T5",
        name: "Environmental Conservation",
        description: "Conservation protocols: recycling waste, saving water, and shielding threatened species.",
        readingTime: "6 mins",
        content: {
          introduction: "Earth is our helper home. Environmental conservation is the careful protection and preservation of our natural resources, forests, seas, and animal life to ensure they do not become extinct.",
          sections: [
            {
              title: "The Three R's of Waste Control",
              body: "• Reduce: Buy and use less plastic wraps.\n• Reuse: Wash and use bags and bottles again instead of throwing them away.\n• Recycle: Sort cardboard, glass, and metals to melt them into new usable items."
            }
          ],
          definition: {
            term: "Conservation",
            meaning: "The smart, defensive guarding of natural resources and habitats to protect them from human destruction or extinction."
          },
          keyTakeaway: "We protect our planet through deliberate eco measures, minimizing waste plastic, and green planting."
        },
        quiz: [
          {
            id: "Q23-1",
            question: "Which of the Three R's is represented when you wash a plastic juice bottle and use it as a seedling flower pot?",
            options: [
              "Reduce",
              "Recycle",
              "Reuse",
              "React"
            ],
            correctAnswerIndex: 2,
            explanation: "Reusing is finding a second life for an item you would normally throw away without sending it to factory melting furnaces first."
          }
        ]
      }
    ]
  }
];

// Initial Student progress consistent with rankings and scores
const RAW_INITIAL_PROGRESS_RECORDS: Record<string, StudentProgress> = {
  // Sophia Cruz (Top student - active user)
  "101234567891": {
    studentLrn: "101234567891",
    completedTopicIds: ["L1-T1", "L1-T2", "L1-T3", "L1-T4", "L1-T5", "L2-T1", "L2-T2", "L2-T3", "L2-T4"],
    quizAttempts: {
      "L1-T1": { topicId: "L1-T1", score: 3, perfectScore: 3, answers: [1, 2, 1], completedAt: "2026-06-01" },
      "L1-T2": { topicId: "L1-T2", score: 3, perfectScore: 3, answers: [2, 0, 2], completedAt: "2026-06-01" },
      "L1-T3": { topicId: "L1-T3", score: 3, perfectScore: 3, answers: [2, 1, 0], completedAt: "2026-06-02" },
      "L1-T4": { topicId: "L1-T4", score: 2, perfectScore: 2, answers: [2, 2], completedAt: "2026-06-02" },
      "L1-T5": { topicId: "L1-T5", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-03" },
      "L2-T1": { topicId: "L2-T1", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-03" },
      "L2-T2": { topicId: "L2-T2", score: 2, perfectScore: 2, answers: [1, 2], completedAt: "2026-06-04" },
      "L2-T3": { topicId: "L2-T3", score: 2, perfectScore: 2, answers: [3, 2], completedAt: "2026-06-04" },
      "L2-T4": { topicId: "L2-T4", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-05" },
    },
    summativeScores: {
      "L1": { score: 19, perfectScore: 20, feedback: "Superb execution! Sophia has shown deep understanding of the skeletal and muscular frameworks, along with digestive and breath cycles. Excellent visual analytical skills." },
      "L2": { score: 18, perfectScore: 20, feedback: "Outstanding score! Solid understanding of states of matter and descriptions of physical vs chemical changes. Keep up this superb effort!" }
    }
  },
  // Ethan Reyes (Excellent performer)
  "101234567892": {
    studentLrn: "101234567892",
    completedTopicIds: ["L1-T1", "L1-T2", "L1-T3", "L1-T4", "L1-T5", "L2-T1", "L2-T2"],
    quizAttempts: {
      "L1-T1": { topicId: "L1-T1", score: 3, perfectScore: 3, answers: [1, 2, 1], completedAt: "2026-06-01" },
      "L1-T2": { topicId: "L1-T2", score: 2, perfectScore: 3, answers: [2, 0, 0], completedAt: "2026-06-01" },
      "L1-T3": { topicId: "L1-T3", score: 2, perfectScore: 3, answers: [2, 1, 1], completedAt: "2026-06-02" },
      "L1-T4": { topicId: "L1-T4", score: 2, perfectScore: 2, answers: [2, 2], completedAt: "2026-06-02" },
      "L1-T5": { topicId: "L1-T5", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-03" },
      "L2-T1": { topicId: "L2-T1", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-04" },
      "L2-T2": { topicId: "L2-T2", score: 2, perfectScore: 2, answers: [1, 2], completedAt: "2026-06-04" },
    },
    summativeScores: {
      "L1": { score: 17, perfectScore: 20, feedback: "Great work! Solid average score. Excellent understanding of breathing muscles. Watch out for joint connectors like cartilage vs tendons." }
    }
  },
  // Chloe Santos (Consistent learner)
  "101234567893": {
    studentLrn: "101234567893",
    completedTopicIds: ["L1-T1", "L1-T2", "L1-T3", "L1-T4", "L1-T5"],
    quizAttempts: {
      "L1-T1": { topicId: "L1-T1", score: 3, perfectScore: 3, answers: [1, 2, 1], completedAt: "2026-06-01" },
      "L1-T2": { topicId: "L1-T2", score: 3, perfectScore: 3, answers: [2, 0, 2], completedAt: "2026-06-01" },
      "L1-T3": { topicId: "L1-T3", score: 2, perfectScore: 3, answers: [2, 1, 1], completedAt: "2026-06-02" },
      "L1-T4": { topicId: "L1-T4", score: 2, perfectScore: 2, answers: [2, 2], completedAt: "2026-06-02" },
      "L1-T5": { topicId: "L1-T5", score: 2, perfectScore: 2, answers: [2, 1], completedAt: "2026-06-03" },
    },
    summativeScores: {
      "L1": { score: 18, perfectScore: 20, feedback: "Terrific core understanding. Exceptionally good grasping of oxygen exchange pathways. Proud of your active learning progress!" }
    }
  },
  // Jacob Flores (Needs Remediation for underperforming on Muscular System)
  "101234567900": {
    studentLrn: "101234567900",
    completedTopicIds: ["L1-T1", "L1-T2"],
    quizAttempts: {
      "L1-T1": { topicId: "L1-T1", score: 1, perfectScore: 3, answers: [0, 2, 0], completedAt: "2026-06-02" },
      "L1-T2": { topicId: "L1-T2", score: 0, perfectScore: 3, answers: [0, 1, 0], completedAt: "2026-06-03" }, // FAILED Muscular System quiz completely
    },
    summativeScores: {
      "L1": { score: 7, perfectScore: 20, feedback: "Attention required. Jacob is struggling with identifying voluntary vs involuntary muscle types and opposing action pairs. Needs targeted tutoring support." }
    }
  }
};

// Seed an initial teacher remediation workbook for Jacob Flores
export const INITIAL_REMEDIATION_MATERIALS: TeacherRemediationMaterial[] = [
  {
    id: "REM-001",
    originalTopicId: "L1-T2",
    title: "AI Remedial Topic: Simple Rubber Band Analogy for Opposing Muscles",
    content: "## Welcome to your Remedial Lesson, Jacob!\nThis quick lesson is custom-built by Mrs. Santos to help you master muscle opposing pairs easily.\n\n### The Rubber Band Analogy\nThink of your muscles as stretchy rubber bands. Stretchy bands can only **pull** things when they tighten; they cannot push things away.\n\nBecause muscles can only pull, they must work in pairs!\n• **Step 1 (Bending)**: To bend your elbow, your biceps muscle on top contracts (squeezes tight and shortens) to pull your arm up. Your triceps muscle on the bottom relaxes (goes loose).\n• **Step 2 (Straightening)**: To straighten your arm, your triceps muscle on the bottom contracts (squeezes tight) to pull the arm straight. Your biceps on top relaxes (goes loose).\n\n### Voluntary vs Involuntary\n- If you choose to wave, that is **voluntary** (your choice!).\n- Your beating heart and swallowing throat happen automatically, so that is **involuntary** (behind-the-scenes!).",
    teacherNotes: "Hi Jacob, I wrote this up to help you understand how skeletal muscles always work in contracted pairs. Read through the simple explanation and answer the quick verification questions!",
    createdQuiz: [
      {
        id: "QREM-MS1",
        question: "Why do skeletal muscles always work in pairs?",
        options: [
          "To allow bones to make red marrow faster",
          "Because muscles can only pull and cannot push bones back",
          "To keep our hips balanced on rocky surfaces",
          "There is no real reason, they just do"
        ],
        correctAnswerIndex: 1,
        explanation: "Since muscles are stretchy fibers that can only pull, you need opposing muscles on each side of a joint to move bones back and forth."
      },
      {
        id: "QREM-MS2",
        question: "Which of your muscles is an example of an Involuntary muscle?",
        options: [
          "The leg muscle you use to kick balls",
          "The bicep in your arm that carries folders",
          "The cardiac heart muscle pumping blood on its own",
          "The fingers grasping pencils"
        ],
        correctAnswerIndex: 2,
        explanation: "The cardiac heart muscle beats automatically without any conscious choice, making it involuntary."
      }
    ],
    publishDate: "2026-06-04",
    assignedStudentLrn: "101234567900", // Jacob Flores
    isPublished: true,
  }
];

export const MOCK_MATH_LESSONS: Lesson[] = [
  {
    id: "L-MATH1",
    title: "Lesson 1: Fractions and Decimals",
    description: "Learn about numerator and denominator parts, identifying simple fractions, and decimal place values.",
    topics: [
      {
        id: "L-MATH1-T1",
        name: "Understanding Fractions",
        description: "An introduction to how portions of a whole are represented using fractional notation.",
        readingTime: "4 mins",
        content: {
          introduction: "A fraction represents a part of a whole. When you divide a whole pizza or a loaf of bread into equal parts, each part is a fraction of the whole.",
          sections: [
            {
              title: "Numerator and Denominator",
              body: "Every fraction has two main numbers:\n1. Numerator (Top Number): This shows how many equal parts you have or are referring to.\n2. Denominator (Bottom Number): This shows the total number of equal parts the whole is divided into."
            },
            {
              title: "Equivalent Fractions",
              body: "Fractions that look different but represent the exact same value are called equivalent fractions. For example, 1/2 is the same as 2/4 or 4/8."
            }
          ],
          definition: {
            term: "Fraction",
            meaning: "A numerical expression showing the ratio of a part to a whole, written as a numerator over a denominator."
          },
          keyTakeaway: "The denominator is the total parts, and the numerator is the parts we have."
        },
        quiz: [
          {
            id: "QM1-1",
            question: "In the fraction 3/4, what does the number 4 represent?",
            options: [
              "The number of parts we have",
              "The total number of equal parts in the whole",
              "The multiplier of the fraction",
              "The decimal equivalent"
            ],
            correctAnswerIndex: 1,
            explanation: "The bottom number, or denominator, represents the total number of equal parts the whole has been divided into."
          },
          {
            id: "QM1-2",
            question: "Which of the following fractions is equivalent to 1/2?",
            options: [
              "2/3",
              "3/6",
              "1/4",
              "4/5"
            ],
            correctAnswerIndex: 1,
            explanation: "3/6 simplifies to 1/2 when you divide the numerator and denominator by 3."
          }
        ]
      },
      {
        id: "L-MATH1-T2",
        name: "Working with Decimals",
        description: "Understanding place values of tenths, hundredths, and matching decimals to fractions.",
        readingTime: "5 mins",
        content: {
          introduction: "Decimals are another way of writing fractional amounts. They use a decimal point to separate the whole number part from the parts that are less than one.",
          sections: [
            {
              title: "Place Value After the Decimal",
              body: "The direct placements to the right of the decimal point represent fractional values:\n• Tenths (1st place): e.g., 0.1 is 1/10.\n• Hundredths (2nd place): e.g., 0.01 is 1/100."
            }
          ],
          definition: {
            term: "Decimal System",
            meaning: "A base-10 number system where points designate values smaller than 1."
          },
          keyTakeaway: "Each position to the right of the decimal point gets 10 times smaller."
        },
        quiz: [
          {
            id: "QM2-1",
            question: "What is the fraction 7/10 written as a decimal number?",
            options: [
              "7.0",
              "0.07",
              "0.7",
              "0.007"
            ],
            correctAnswerIndex: 2,
            explanation: "The first digit to the right of the decimal point is the tenths place, so 7/10 is written as 0.7."
          }
        ]
      }
    ]
  },
  {
    id: "L-MATH2",
    title: "Lesson 2: Geometry and Shapes",
    description: "Explore the properties of 2D polygons, 3D solids, and calculations for perimeter and area.",
    topics: [
      {
        id: "L-MATH2-T1",
        name: "2D and 3D Shapes",
        description: "Symmetry, vertices, edges, and sides of squares, polygons, and prisms.",
        readingTime: "5 mins",
        content: {
          introduction: "Geometry is the study of shapes and space. Shapes can be two-dimensional (flat) or three-dimensional (solid).",
          sections: [
            {
              title: "Polygons and Properties",
              body: "Polygons are flat 2D shapes with straight lines. For example, a triangle has 3 sides and 3 vertices (corners), while a quadrilateral has 4 sides."
            },
            {
              title: "Three-Dimensional Solids",
              body: "3D shapes have length, width, and height. They include cubes, spheres, and cylinders. They have faces (flat surfaces), edges (where surfaces meet), and vertices (corners)."
            }
          ],
          definition: {
            term: "Polygon",
            meaning: "A flat, closed 2D shape with three or more straight sides."
          },
          keyTakeaway: "Flat shapes are 2D, while solid shapes that take up physical space are 3D."
        },
        quiz: [
          {
            id: "QM3-1",
            question: "How many vertices does a standard cube solid have?",
            options: [
              "4 vertices",
              "6 vertices",
              "8 vertices",
              "12 vertices"
            ],
            correctAnswerIndex: 2,
            explanation: "A cube has 6 flat faces, 12 edges, and exactly 8 vertices (corners)."
          }
        ]
      }
    ]
  }
];

export const MOCK_ENGLISH_LESSONS: Lesson[] = [
  {
    id: "L-ENG1",
    title: "Lesson 1: Parts of Speech",
    description: "Learn to identify nouns, pronouns, verbs, and tenses to write elegant and expressive stories.",
    topics: [
      {
        id: "L-ENG1-T1",
        name: "Nouns & Pronouns",
        description: "Identify names of persons, places, and things, plus pronoun substitutes.",
        readingTime: "4 mins",
        content: {
          introduction: "Words are grouped into different types called parts of speech. Nouns and pronouns form the actors of every sentence.",
          sections: [
            {
              title: "Nouns are Names",
              body: "A noun is a word that names a person, place, thing, or idea. Common nouns are generic (dog, city), while proper nouns name specific entities (Rover, Manila) and always start with a capital letter."
            },
            {
              title: "Pronouns are Replacements",
              body: "Pronouns are words used in place of nouns to avoid repetition. Instead of saying 'Sophia went to Sophia's room', we say 'Sophia went to her room'. Examples include he, she, they, we, and it."
            }
          ],
          definition: {
            term: "Noun",
            meaning: "A word that functions as the name of some specific thing or set of things, such as living creatures, objects, places, actions, or ideas."
          },
          keyTakeaway: "Nouns name what we talk about; pronouns stand in so we do not sound repetitive."
        },
        quiz: [
          {
            id: "QE1-1",
            question: "Which of the following is a Proper Noun?",
            options: [
              "school",
              "Sunday",
              "river",
              "teacher"
            ],
            correctAnswerIndex: 1,
            explanation: "Sunday is a proper noun because it names a specific day of the week, so it is capitalized."
          },
          {
            id: "QE1-2",
            question: "Choose the pronoun in the sentence: 'They ran to the school library together.'",
            options: [
              "school",
              "They",
              "ran",
              "together"
            ],
            correctAnswerIndex: 1,
            explanation: "'They' is a personal pronoun used to replace the nouns representing the group of people."
          }
        ]
      },
      {
        id: "L-ENG1-T2",
        name: "Verbs & Tenses",
        description: "Action words, linking verbs, and conjugation across past, present, and future tenses.",
        readingTime: "5 mins",
        content: {
          introduction: "Every complete sentence must contain a verb. Verbs represent actions, states of being, or experiences.",
          sections: [
            {
              title: "Action vs. Linking Verbs",
              body: "• Action Verbs: Express physical or mental actions (run, think, write).\n• Linking Verbs: Connect the subject to a description (is, are, was, became)."
            },
            {
              title: "Understanding Verb Tenses",
              body: "Tenses show when the action takes place:\n• Past: happened before (e.g. walked, talked).\n• Present: happening now (e.g. walks, talks).\n• Future: will happen later (e.g. will walk, will talk)."
            }
          ],
          definition: {
            term: "Verb",
            meaning: "A word used to describe an action, state, or occurrence, forming the main part of the predicate of a sentence."
          },
          keyTakeaway: "Verbs are the engine of sentences, defining physical actions and timelines."
        },
        quiz: [
          {
            id: "QE2-1",
            question: "Identify the future tense verb in these phrases:",
            options: [
              "He study science online",
              "He studied science",
              "He will study science",
              "He studies science"
            ],
            correctAnswerIndex: 2,
            explanation: "'will study' uses the auxiliary verb 'will' to specify a future tense action."
          }
        ]
      }
    ]
  },
  {
    id: "L-ENG2",
    title: "Lesson 2: Vocabulary & Comprehension",
    description: "Expand your descriptive vocabulary using synonyms, antonyms, and reading context clues.",
    topics: [
      {
        id: "L-ENG2-T1",
        name: "Synonyms and Antonyms",
        description: "How to use varied definitions and matching opposites to make your narratives stand out.",
        readingTime: "4 mins",
        content: {
          introduction: "Writing gets much more exciting when you choose precise, descriptive vocabulary.",
          sections: [
            {
              title: "Synonyms: Matching Meanings",
              body: "Synonyms are words with identical or very similar meanings. Instead of using 'big' repeatedly, use sturdy synonyms like giant, immense, or colossal."
            },
            {
              title: "Antonyms: Opposites",
              body: "Antonyms are words with opposite meanings, like hot and cold, heavy and lightweight, or swift and sluggish."
            }
          ],
          definition: {
            term: "Antonym",
            meaning: "A word opposite in meaning to another (e.g. bad and good)."
          },
          keyTakeaway: "Synonyms mean the same, antonyms mean the opposite."
        },
        quiz: [
          {
            id: "QE3-1",
            question: "What is an antonym for the word 'swift'?",
            options: [
              "fast",
              "sluggish",
              "energetic",
              "bright"
            ],
            correctAnswerIndex: 1,
            explanation: "'Sluggish' means slow, which is the direct opposite (antonym) of 'swift' (fast)."
          }
        ]
      }
    ]
  }
];

const RAW_LESSONS_BY_SUBJECT: Record<string, Lesson[]> = {
  science: MOCK_LESSONS,
  mathematics: MOCK_MATH_LESSONS,
  english: MOCK_ENGLISH_LESSONS
};

// Normalize every topic to a consistent 10-question quiz (quizgen.ts) so the
// student quiz, seeded progress, and teacher records share one denominator.
// Deterministic, so the runtime catalog and the exported server seed match.
export const MOCK_LESSONS_BY_SUBJECT: Record<string, Lesson[]> = expandLessons(RAW_LESSONS_BY_SUBJECT);

// Student records start BLANK (reset). The curated demo progress is preserved in
// RAW_INITIAL_PROGRESS_RECORDS above — to restore it, export:
//   scaleProgressToQuizSize(RAW_INITIAL_PROGRESS_RECORDS)
export const INITIAL_PROGRESS_RECORDS: Record<string, StudentProgress> = {};
void scaleProgressToQuizSize; // kept available for restoring the seeded records
