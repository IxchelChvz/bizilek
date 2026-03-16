import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

function App() {
  return (
    <div>
        <NavigationMenu className="bg-slate-400 max-w-full flex justify-end p-4">
        <NavigationMenuList>
            <NavigationMenuItem>
            <NavigationMenuTrigger>Inicio</NavigationMenuTrigger>
            <NavigationMenuContent>
                <NavigationMenuLink>Link</NavigationMenuLink>
            </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
                <NavigationMenuLink>Sobre Nosotros</NavigationMenuLink>
            </NavigationMenuItem>
        </NavigationMenuList>
        </NavigationMenu>
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">
          ¡Sobreviví a la instalación de React y Tailwind! 🚀
        </h1>
        <p className="text-muted-foreground">
          Si el botón de abajo se ve bien, ya estamos del otro lado.
        </p>
        
        {/* Aquí está el componente de shadcn */}
        <Button size="lg">Mi primer botón shadcn</Button>
      </div>
    </div>
  )
}

export default App