import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { useUserStore } from "@/stores/userStore"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  const { user } = useUserStore();

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : user?.profilePicture ? (
        <AvatarImage src={user.profilePicture} alt="Profile" />
      ) : (
        <AvatarFallback>
          <span className="text-white/90">{user?.name ? user.name[0].toUpperCase() : ''}</span>
        </AvatarFallback>
      )}
    </AvatarPrimitive.Root>
  );
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  const { user } = useUserStore();
  
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-gray-100 border border-gray-200",
        className
      )}
      {...props}
    >
      {props.children || <span className="text-white/90">{user?.name ? user.name[0].toUpperCase() : ''}</span>}
    </AvatarPrimitive.Fallback>
  );
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
