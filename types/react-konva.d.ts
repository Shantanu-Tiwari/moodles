declare module "react-konva" {
    import * as React from "react";
    import * as Konva from "konva";
    
    export interface StageProps extends Konva.StageConfig {
        width: number;
        height: number;
        onMouseDown?: (e: any) => void;
        onMouseMove?: (e: any) => void;
        onMouseUp?: (e: any) => void;
        onMousemove?: (e: any) => void;
        onMouseup?: (e: any) => void;
        ref?: React.RefObject<any>;
        children?: React.ReactNode;
    }
    export class Stage extends React.Component<StageProps> {}

    export interface LayerProps extends Konva.LayerConfig {
        children?: React.ReactNode;
    }
    export class Layer extends React.Component<LayerProps> {}

    export interface LineProps extends Konva.LineConfig {
        points: number[];
        stroke?: string;
        strokeWidth?: number;
        tension?: number;
        lineCap?: string;
        lineJoin?: string;
        key?: string | number;
    }
    export class Line extends React.Component<LineProps> {}
}
