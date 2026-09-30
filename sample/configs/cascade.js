export const pitchRoom = {
  brand: {
    name: "Cascade",
    logo: "assets/cascade-logo-final.svg",
    mark: "assets/cascade-mark-static.svg",
    shaderTexture: "assets/cascade-shader-source.png",
    flowTexture: "assets/cascade-shader-source.png",
  },
  hero: {
    hidden: true,
    title: "Turning unfair advantage into something you can feel.",
    body: "Cascade gives AEC teams an earlier view of what’s coming. The opportunity was to turn that advantage into a brand built around momentum, foresight, and being one step ahead.",
  },
  tiles: [
    {
      id: "clay",
      type: "web",
      src: "assets/cascade-web.svg?v=20260929-3",
      label: "Cascade website experience",
    },
    { id: "logo", type: "logo", label: "Cascade logo on cream" },
    {
      id: "flow",
      type: "flow",
      label: "Cascade opportunity flow from inputs to mapped opportunities",
      variant: "map",
      demoValues: ["Brooklyn, NY", "Civil", "$12.8M"],
      map: "assets/opportunity-map.svg",
      options: [
        "assets/opportunity-mini-1.svg",
        "assets/opportunity-mini-2.svg",
        "assets/opportunity-mini-3.svg",
      ],
      result: "assets/opportunity-card-2.svg",
      legacy: {
        scanCard: "assets/cascade-card.svg",
        result: "assets/final-card.svg",
        demoValues: ["Dallas, TX", "Aviation", "$12.8M"],
      },
    },
    {
      id: "motion",
      type: "motion",
      label: "Animated Cascade mark on signal orange",
    },
    { id: "phone", type: "phone", src: "assets/cascade-phone.png?v=20260928-2", label: "Cascade mobile experience" },
  ],
};
