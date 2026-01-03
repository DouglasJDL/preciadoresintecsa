Diagrama textual de dependencias

presentation/* → depende de → application/actions.js

application/actions.js → depende de → domain/* + infrastructure/* + presentation/* (orquestación)

domain/* → NO depende de nada de infraestructura ni DOM (puro)

infrastructure/* → depende de → domain/* (implementa puertos/funciones) y APIs browser (fetch, localStorage, canvas)

config/* → puede ser importado por todos

En forma compacta: 

presentation  ───▶ application ───▶ domain
                    ▲              ▲
                    │              │
                infrastructure ────┘
(infrastructure implementa lo que domain necesita; domain no conoce infra)



